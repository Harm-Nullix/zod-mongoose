import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { createRequire } from "node:module";
import { setHeader } from "h3";

const require = createRequire(import.meta.url);
const zodRoot = dirname(dirname(require.resolve("zod/v4")));
let cachedTypes: Promise<Record<string, string>> | undefined;

async function collect(directory: string, files: Record<string, string>) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path, files);
    else if (entry.name.endsWith(".d.ts")) {
      files[`file:///node_modules/zod/${relative(zodRoot, path).replaceAll("\\", "/")}`] = await readFile(path, "utf8");
    }
  }
}

export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "public, max-age=3600");
  cachedTypes ||= (async () => {
    const files: Record<string, string> = {};
    await collect(join(zodRoot, "v4"), files);
    return files;
  })();
  return cachedTypes;
});
