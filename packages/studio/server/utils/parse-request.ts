import { createError } from "h3";
import type { H3Event } from "h3";
import type { ParseBody } from "./studio-execution";

const MAX_BODY_BYTES = 160_000;

export async function readStudioRequest(event: H3Event): Promise<ParseBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of event.node.req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw createError({ statusCode: 413, message: "Studio input is too large." });
    chunks.push(bytes);
  }
  let body: ParseBody;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw createError({ statusCode: 400, message: "Invalid JSON request." }); }
  if (typeof body?.sourceCode !== "string" || !body.sourceCode.trim()) {
    throw createError({ statusCode: 400, message: "Add a Zod schema to the editor first." });
  }
  if (body.sourceCode.length > 50_000 || typeof body.inputData !== "string" || body.inputData.length > 100_000 ||
      (body.selectedSchema !== undefined && typeof body.selectedSchema !== "string") ||
      (body.action !== undefined && body.action !== "run" && body.action !== "example")) {
    throw createError({ statusCode: 400, message: "Invalid or oversized Studio input." });
  }
  return body;
}
