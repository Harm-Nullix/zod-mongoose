import { executeStudio } from "../server/utils/studio-execution";
import type { ParseBody } from "../server/utils/studio-execution";

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk.toString();
  const body = JSON.parse(input) as ParseBody;
  const payload = JSON.stringify(executeStudio(body, 1000));
  if (Buffer.byteLength(payload) > 1_000_000) throw new Error("Studio result is too large.");
  process.stdout.write(payload);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message.slice(0, 500));
  process.exitCode = 1;
});
