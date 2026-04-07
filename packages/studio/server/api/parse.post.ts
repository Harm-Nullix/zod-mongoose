import { defineEventHandler, readBody, createError } from "h3";
import vm from "node:vm";
import { transformSync } from "esbuild";
import util from "node:util";

import * as zod from "zod";
import * as mongooseZod from "@nullix/zod-mongoose";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const isDocsMode = config.public.isDocsMode;
  const { sourceCode } = await readBody(event);

  if (!sourceCode) {
    throw createError({ statusCode: 400, message: "Missing sourceCode" });
  }

  // 1. Transpile exactly what the user wrote
  let jsCode = "";
  try {
    const result = transformSync(sourceCode, {
      loader: "ts",
      format: "cjs",
      target: "esnext",
    });
    jsCode = result.code;
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      message: `Compilation Error: ${e.message}`,
    });
  }

  // 2. Map imports securely
  const sandboxRequire = (moduleName: string) => {
    if (moduleName === "zod" || moduleName === "zod/v4") return zod;
    if (moduleName === "@nullix/zod-mongoose") return mongooseZod;
    throw new Error(`Security Exception: Module "${moduleName}" is blocked.`);
  };

  const sandbox = {
    require: sandboxRequire,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    __filename: "/sandbox/main.ts",
    __dirname: "/sandbox",
  };
  const context = vm.createContext(sandbox);

  try {
    const script = new vm.Script(`
      (() => {
        let exports = {};
        let module = { exports };

        ${jsCode}

        return module.exports;
      })();
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
    return {
      definition: util.inspect(extractedDef, formatOpts),
      schemaObj: util.inspect(mongooseSchema, formatOpts),
    };
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: `Execution Error: ${err.message}`,
    });
  }
});
