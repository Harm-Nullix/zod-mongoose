#!/usr/bin/env node
import { getPort } from "get-port-please";
import open from "open";
import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(__dirname, "../.output/server/index.mjs");

async function startStudio() {
  // 1. Parse CLI Arguments
  const { values } = parseArgs({
    options: {
      port: { type: "string", short: "p" },
      "no-fs": { type: "boolean" }, // Optional opt-out flag
    },
    strict: false, // Allow other random args without crashing
  });

  console.log("🚀 Starting @nullix/zod-mongoose Studio...");

  // 2. Determine Port
  let port = values.port ? parseInt(values.port, 10) : undefined;
  if (!port || isNaN(port)) {
    port = await getPort({ portRange: [3000, 4000] });
  }

  // 3. Determine Modes
  const enableFs = !values["no-fs"];

  // 4. Set strict environment variables for the Nitro server
  const env = {
    ...process.env,
    PORT: port.toString(),
    DOCS_MODE: "false", // CLI is NEVER docs mode
    LOCAL_MODE: enableFs ? "true" : "false", // Enable FS unless opted out
    NODE_ENV: "production",
  };

  // 5. Fork the Nuxt Nitro server
  const serverProcess = fork(serverEntry, [], { env });

  const url = `http://localhost:${port}`;
  console.log(`⏳ Starting server on ${url}...`);

  setTimeout(() => {
    console.log(`✅ Studio running!`);
    if (enableFs) {
      console.log(
        `📁 Filesystem Access: ENABLED (Workspace root: ${process.cwd()})`,
      );
    } else {
      console.log(`🔒 Filesystem Access: DISABLED (--no-fs flag provided)`);
    }
    open(url);
  }, 1500);

  process.on("SIGINT", () => {
    serverProcess.kill();
    process.exit(0);
  });
}

startStudio().catch((err) => {
  console.error("Failed to start studio:", err);
  process.exit(1);
});
