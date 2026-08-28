import { defineEventHandler, readBody, createError } from "h3";
import vm from "node:vm";
import { transformSync } from "esbuild";
import util from "node:util";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import * as zod from "zod";
import * as mongoose from "mongoose";
import * as mongooseZod from "@nullix/zod-mongoose";

// Initialize Mongoose in ESM environment
mongooseZod.setMongoose(mongoose.default || mongoose);

// Shim __filename and __dirname for ESM environments (Nitro)
let _filename = "/sandbox/main.ts";
let _dirname = "/sandbox";

try {
  _filename = fileURLToPath(import.meta.url);
  _dirname = dirname(_filename);
} catch {
  // Fallback if import.meta.url is not available or valid in the current context
}

// The converter exposes a module-level Hookable instance. User code can add
// hooks to it, so parse requests must not overlap and must always clean it up
// before the next request starts.
let parseQueue = Promise.resolve();

async function acquireParseLock(): Promise<() => void> {
  const previous = parseQueue;
  let release!: () => void;

  parseQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  return release;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

// @ts-ignore
if (typeof __filename === "undefined") {
  // @ts-ignore
  globalThis.__filename = _filename;
}
// @ts-ignore
if (typeof __dirname === "undefined") {
  // @ts-ignore
  globalThis.__dirname = _dirname;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const isDocsMode = config.public.isDocsMode;
  const { sourceCode } = await readBody(event);

  if (!sourceCode) {
    throw createError({ statusCode: 400, message: "Missing sourceCode" });
  }

  const releaseParseLock = await acquireParseLock();

  // 1. Transpile exactly what the user wrote
  try {
    // A user hook can throw before the converter has completed. Since hooks are
    // global within the server process, cleanup must happen for both success and
    // failure, otherwise the user's hook would affect every later visitor.
    mongooseZod.hooks.removeAllHooks();

    let jsCode: string;
    try {
      jsCode = transformSync(sourceCode, {
        loader: "ts",
        format: "cjs",
        target: "esnext",
        // Provide these globals during transpilation just in case
        define: {
          __filename: '"/sandbox/main.ts"',
          __dirname: '"/sandbox"',
        },
      }).code;
    } catch (error: unknown) {
      throw createError({
        statusCode: 400,
        message: `Compilation Error: ${getErrorMessage(error)}`,
      });
    }
    // 2. Map imports securely
    const sandboxRequire = (moduleName: string) => {
      if (moduleName === "zod" || moduleName === "zod/v4") return zod;
      if (moduleName === "@nullix/zod-mongoose") return mongooseZod;
      if (moduleName === "mongoose") return mongoose.default || mongoose;
      throw new Error(`Security Exception: Module "${moduleName}" is blocked.`);
    };

    const sandbox = {
      require: sandboxRequire,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      __filename: "/sandbox/main.ts",
      __dirname: "/sandbox",
    };
    const context = vm.createContext(sandbox);

    const script = new vm.Script(`
      ((__filename, __dirname) => {
        let exports = {};
        let module = { exports };

        ${jsCode}

        return module.exports;
      })("/sandbox/main.ts", "/sandbox");
    `);

    // 3. Execute code and grab the default export
    const rawExport = script.runInContext(context, {
      timeout: isDocsMode ? 1000 : 5000,
    });

    const schema = rawExport.default || rawExport;

    if (!schema || !schema._def) {
      throw new Error("You must `export default` a valid Zod schema.");
    }

    // 4. Run BOTH functions on the user's schema
    const extractedDef = mongooseZod.extractMongooseDef(schema);
    const mongooseSchema = mongooseZod.toMongooseSchema(schema);

    // Format the outputs nicely
    const formatOpts = { depth: null, showHidden: false, colors: false };

    // Mongoose schemas are massive class instances, so we extract the raw .obj definition to display
    const formatValue = (val: any): any => {
      if (typeof val === "function") {
        return val.name || val.toString();
      }
      if (Array.isArray(val)) {
        return val.map(formatValue);
      }
      if (
        val !== null &&
        typeof val === "object" &&
        val.constructor === Object
      ) {
        const formatted: any = {};
        for (const key in val) {
          formatted[key] = formatValue(val[key]);
        }
        return formatted;
      }
      return val;
    };

    const formattedDef = formatValue(extractedDef);
    // schemaObj is a Mongoose Schema instance, we only care about its .obj for display
    const formattedSchema = formatValue(mongooseSchema.obj);
    // @ts-ignore
    const formattedTree = formatValue(mongooseSchema.tree);
    // @ts-ignore
    const formattedPaths = formatValue(mongooseSchema.paths);

    return {
      definition: util.inspect(formattedDef, formatOpts),
      schemaObj: util.inspect(formattedSchema, formatOpts),
      schemaTree: util.inspect(formattedTree, formatOpts),
      schemaPaths: util.inspect(formattedPaths, formatOpts),
    };
  } catch (err: any) {
    const message = getErrorMessage(err);
    const isCompilationError = err?.statusCode === 400;
    throw createError({
      statusCode: isCompilationError ? 400 : 500,
      message: isCompilationError ? message : `Execution Error: ${message}`,
    });
  } finally {
    mongooseZod.hooks.removeAllHooks();
    releaseParseLock();
  }
});
