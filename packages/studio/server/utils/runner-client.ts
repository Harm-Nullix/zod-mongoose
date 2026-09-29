import { createError } from "h3";
import { request } from "node:http";
import type { ParseBody } from "./studio-execution";

const MAX_RESPONSE_BYTES = 1_000_000;

export function runInContainer(body: ParseBody, socketPath: string): Promise<unknown> {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = request({
      socketPath,
      path: "/run",
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy(new Error("Studio result is too large."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (res.statusCode !== 200) {
            reject(createError({ statusCode: res.statusCode === 400 ? 400 : res.statusCode === 504 ? 504 : 503, message: result.error || "Studio runner failed." }));
          } else resolve(result);
        } catch { reject(createError({ statusCode: 502, message: "Invalid response from Studio runner." })); }
      });
      res.on("error", reject);
    });
    req.setTimeout(5000, () => req.destroy(new Error("Studio runner timed out.")));
    req.on("error", reject);
    req.end(payload);
  });
}
