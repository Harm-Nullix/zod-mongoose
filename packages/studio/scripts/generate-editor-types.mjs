import { createRequire } from "node:module";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const zodRoot = dirname(dirname(require.resolve("zod/v4")));
const destination = fileURLToPath(new URL("../server/utils/editor-types.json", import.meta.url));
const files = {};

async function collect(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.name.endsWith(".d.ts")) {
      const name = relative(zodRoot, path).replaceAll("\\", "/");
      files[`file:///node_modules/zod/${name}`] = await readFile(path, "utf8");
    }
  }
}

await collect(join(zodRoot, "v4"));
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(files));
process.stdout.write(`Wrote ${Object.keys(files).length} Zod type files to ${destination}\n`);
