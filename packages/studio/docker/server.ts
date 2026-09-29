import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { chmodSync, chownSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParseBody } from "../server/utils/studio-execution";

const socketPath = process.env.STUDIO_RUNNER_SOCKET || "/run/zod-studio/runner.sock";
const workerPath = fileURLToPath(new URL("./worker.mjs", import.meta.url));
const MAX_ACTIVE = 2;
const MAX_QUEUE = 8;
const JOB_TIMEOUT_MS = 3000;
const MAX_BODY_BYTES = 160_000;
const MAX_RESULT_BYTES = 1_000_000;
const SOCKET_UID = 1000;
const SOCKET_GID = 1000;
const FIRST_WORKER_UID = 100_000;
const LAST_WORKER_UID = 2_000_000_000;

type Job = { body: ParseBody; resolve: (value: string) => void; reject: (error: Error) => void };
const queue: Job[] = [];
let active = 0;
let nextWorkerUid = FIRST_WORKER_UID;
let stopping = false;

function runIsolated(job: Job) {
  // A fresh UID prevents a vm escape from accessing the socket or another request.
  const uid = nextWorkerUid++;
  const child = spawn(process.execPath, ["--max-old-space-size=192", workerPath], {
    uid, gid: uid, detached: true, stdio: ["pipe", "pipe", "pipe"],
    env: { NODE_ENV: "production", HOME: "/nonexistent", TMPDIR: "/nonexistent" },
  });
  let result = "";
  let errorOutput = "";
  let outputBytes = 0;
  let settled = false;
  let timedOut = false;
  const killGroup = () => {
    if (!child.pid) return;
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already exited. */ }
  };
  const timer = setTimeout(() => { timedOut = true; killGroup(); }, JOB_TIMEOUT_MS);
  const finish = (error?: Error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    killGroup();
    active--;
    if (error) job.reject(error);
    else job.resolve(result);
    dispatch();
  };
  child.stdout.on("data", (chunk: Buffer) => {
    outputBytes += chunk.length;
    if (outputBytes > MAX_RESULT_BYTES) { killGroup(); return; }
    result += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    errorOutput += chunk.toString("utf8").slice(0, Math.max(0, 500 - errorOutput.length));
  });
  child.on("error", (error) => finish(error));
  child.on("close", (code) => {
    if (timedOut) finish(new Error("Studio execution timed out."));
    else if (outputBytes > MAX_RESULT_BYTES) finish(new Error("Studio result is too large."));
    else if (code !== 0) finish(new Error(errorOutput || "Studio execution failed."));
    else if (!result) finish(new Error("Studio worker returned no result."));
    else finish();
  });
  child.stdin.on("error", () => { /* A terminated worker may close stdin early. */ });
  child.stdin.end(JSON.stringify(job.body));
}

function dispatch() {
  while (!stopping && active < MAX_ACTIVE && queue.length) {
    const job = queue.shift()!;
    active++;
    if (nextWorkerUid > LAST_WORKER_UID) {
      active--;
      job.reject(new Error("Studio runner must be restarted."));
      continue;
    }
    try { runIsolated(job); }
    catch (error) {
      active--;
      job.reject(error instanceof Error ? error : new Error("Studio execution failed."));
    }
  }
}

function run(body: ParseBody): Promise<string> {
  if (queue.length >= MAX_QUEUE) return Promise.reject(new Error("Studio is busy. Try again shortly."));
  return new Promise((resolve, reject) => {
    queue.push({ body, resolve, reject });
    dispatch();
  });
}

async function readBody(req: IncomingMessage): Promise<ParseBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw new Error("Studio input is too large.");
    chunks.push(bytes);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body.sourceCode !== "string" || !body.sourceCode.trim() || body.sourceCode.length > 50_000 ||
      typeof body.inputData !== "string" || body.inputData.length > 100_000 ||
      (body.selectedSchema !== undefined && typeof body.selectedSchema !== "string") ||
      (body.action !== undefined && body.action !== "run" && body.action !== "example")) {
    throw new Error("Invalid Studio input.");
  }
  return body;
}

function send(res: ServerResponse, status: number, value: unknown) {
  const data = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(data), "cache-control": "no-store" });
  res.end(data);
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/run") { send(res, 404, { error: "Not found." }); return; }
  try {
    const body = await readBody(req);
    const result = await run(body);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(result), "cache-control": "no-store" });
    res.end(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Studio execution failed.";
    const status = message.includes("busy") || message.includes("must be restarted") || message.includes("returned no result")
      ? 503 : message.includes("timed out") ? 504 : 400;
    send(res, status, { error: message });
  }
});

mkdirSync(dirname(socketPath), { recursive: true });
rmSync(socketPath, { force: true });
process.umask(0o077);
server.listen(socketPath, () => {
  chmodSync(socketPath, 0o660);
  chownSync(socketPath, SOCKET_UID, SOCKET_GID);
  process.stdout.write("Studio runner listening on " + socketPath + "\n");
});
process.on("SIGTERM", () => {
  stopping = true;
  server.close();
  rmSync(socketPath, { force: true });
});
