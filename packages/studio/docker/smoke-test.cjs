const assert = require("node:assert/strict");
const http = require("node:http");

function run(sourceCode, action = "run", inputData = "{}") {
  const body = JSON.stringify({ sourceCode, action, inputData });
  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath: "/run/zod-studio/runner.sock",
      path: "/run",
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

async function main() {
  const uidSource = 'const p = z.string().constructor.constructor("return process")(); const S = z.object({uid: z.number()}); const exampleInput = {uid: p.getuid()};';
  const [first, second] = await Promise.all([run(uidSource, "example"), run(uidSource, "example")]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const firstUid = JSON.parse(first.body.example).uid;
  const secondUid = JSON.parse(second.body.example).uid;
  assert.notEqual(firstUid, secondUid);

  const socketSource = 'const p = z.string().constructor.constructor("return process")(); const fs = p.getBuiltinModule("node:fs"); const S = z.object({socket: z.boolean()}); const exampleInput = {socket: fs.existsSync("/run/zod-studio/runner.sock")};';
  const socket = await run(socketSource, "example");
  assert.equal(socket.status, 200);
  assert.equal(JSON.parse(socket.body.example).socket, false);

  const timeout = await run("while(true){}");
  assert.equal(timeout.status, 504);
  assert.match(timeout.body.error, /timed out/);

  const recovery = await run('const S = z.object({name:z.string()});', "run", '{"name":"Ada"}');
  assert.equal(recovery.status, 200);
  assert.equal(recovery.body.validation.status, "valid");
  process.stdout.write("Unique UIDs, socket isolation, timeout, and recovery passed.\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
