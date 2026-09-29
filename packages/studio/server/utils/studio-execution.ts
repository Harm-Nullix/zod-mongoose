import vm from "node:vm";
import { transformSync } from "esbuild";
import util from "node:util";
import { parse } from "acorn";
import * as zod from "zod/v4";
import mongoose from "mongoose";
import * as mongooseZod from "@nullix/zod-mongoose";
import { createExample } from "./example-data";

mongooseZod.setMongoose(mongoose);

export class StudioExecutionError extends Error {
  statusCode = 400;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error);
}

function declaredNames(jsCode: string): string[] {
  const file = parse(jsCode, { ecmaVersion: "latest", sourceType: "script" });
  const names: string[] = [];
  for (const statement of file.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declaration of statement.declarations) {
      if (declaration.id.type === "Identifier") names.push(declaration.id.name);
    }
  }
  return names;
}

function displayValue(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return `${item.toString()}n`;
    if (typeof item === "undefined") return "[undefined]";
    if (typeof item === "number" && !Number.isFinite(item)) return String(item);
    if (typeof item === "object" && item !== null) {
      if (item instanceof Date) return item.toISOString();
      if (typeof item.toHexString === "function") return item.toHexString();
      if (seen.has(item)) return "[Circular]";
      seen.add(item);
    }
    return item;
  }, 2) || "undefined";
}

function formatMongoose(value: any): any {
  if (typeof value === "function") return value.name || value.toString();
  if (Array.isArray(value)) return value.map(formatMongoose);
  if (value !== null && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, formatMongoose(entry)]));
  }
  return value;
}

export type ParseBody = {
  sourceCode?: string;
  inputData?: string;
  selectedSchema?: string;
  action?: "run" | "example";
};

export function executeStudio(body: ParseBody, timeoutMs: number) {
  const sourceCode = body.sourceCode!;
  mongooseZod.hooks.removeAllHooks();
  try {
    let jsCode: string;
    try {
      jsCode = transformSync(sourceCode, { loader: "ts", format: "cjs", target: "esnext" }).code;
    } catch (error) {
      throw new StudioExecutionError(`Compilation error: ${errorMessage(error)}`);
    }
    const names = declaredNames(jsCode);

    const sandboxRequire = (moduleName: string) => {
      if (moduleName === "zod" || moduleName === "zod/v4") return zod;
      if (moduleName === "@nullix/zod-mongoose") return mongooseZod;
      if (moduleName === "mongoose") return mongoose;
      throw new Error(`Module "${moduleName}" is unavailable in Studio.`);
    };
    const context = vm.createContext({
      ...mongooseZod,
      z: zod.z,
      mongoose,
      require: sandboxRequire,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      __filename: "/sandbox/main.ts",
      __dirname: "/sandbox",
    });
    const captured = names.map((name) => `${JSON.stringify(name)}: typeof ${name} === "undefined" ? undefined : ${name}`).join(",");
    const script = new vm.Script(`
      (() => {
        let exports = {};
        let module = { exports };
        ${jsCode}
        return { exported: module.exports, declared: { ${captured} } };
      })()
    `);
    const result = script.runInContext(context, { timeout: timeoutMs });
    const choices = new Map<string, zod.ZodType>();
    for (const [name, value] of Object.entries(result.declared)) {
      if (value instanceof zod.ZodType && ![...choices.values()].includes(value)) choices.set(name, value);
    }
    for (const [name, value] of Object.entries(result.exported || {})) {
      if (value instanceof zod.ZodType && ![...choices.values()].includes(value)) choices.set(name, value);
    }
    const defaultExport = result.exported instanceof zod.ZodType ? result.exported : result.exported?.default;
    if (defaultExport instanceof zod.ZodType && ![...choices.values()].includes(defaultExport)) choices.set("default", defaultExport);
    if (!choices.size) throw new Error("Define a Zod schema, such as const UserSchema = z.object({ name: z.string() }).");

    const selectedSchema = body.selectedSchema && choices.has(body.selectedSchema)
      ? body.selectedSchema : choices.keys().next().value as string;
    const schema = choices.get(selectedSchema)!;
    const schemaNames = [...choices.keys()];

    let example: string | undefined;
    let exampleError: string | undefined;
    let inputData = body.inputData;
    if (body.action === "example") {
      try {
        const fixture = result.declared.exampleInput;
        const generated = fixture !== undefined ? fixture : createExample(schema as any);
        const exampleResult = schema.safeParse(generated);
        if (!exampleResult.success) throw new Error("The example does not satisfy this schema. Add or update a valid const exampleInput for custom rules.");
        example = displayValue(generated);
        inputData = example;
      } catch (error) {
        exampleError = errorMessage(error);
      }
    }

    let validation: { status: "valid" | "invalid" | "json-error" | "parse-error" | "empty"; parsed?: string; issues?: { path: string; message: string; code: string }[]; message?: string } = { status: "empty" };
    if (typeof inputData !== "string" || !inputData.trim()) {
      validation = { status: "empty", message: "Add JSON data to try this schema." };
    } else {
      let input: unknown;
      let inputValid = false;
      try {
        input = JSON.parse(inputData);
        inputValid = true;
      } catch (error) {
        validation = { status: "json-error", message: errorMessage(error) };
      }
      if (inputValid) {
        try {
          const parsed = schema.safeParse(input);
          validation = parsed.success
            ? { status: "valid", parsed: displayValue(parsed.data) }
            : { status: "invalid", issues: parsed.error.issues.map((issue) => ({ path: issue.path.length ? issue.path.join(".") : "(root)", message: issue.message, code: issue.code })) };
        } catch (error) {
          validation = { status: "parse-error", message: `Validation could not run: ${errorMessage(error)}` };
        }
      }
    }

    let conversion: { definition?: string; schemaObj?: string; schemaTree?: string; schemaPaths?: string; error?: string };
    try {
      const extracted = mongooseZod.extractMongooseDef(schema);
      const converted = mongooseZod.toMongooseSchema(schema, { modelName: "ParsedSchema" });
      const inspect = (value: unknown) => util.inspect(formatMongoose(value), { depth: null, colors: false, showHidden: false });
      conversion = {
        definition: inspect(extracted),
        schemaObj: inspect(converted.obj),
        schemaTree: inspect((converted as any).tree),
        schemaPaths: inspect((converted as any).paths),
      };
    } catch (error) {
      conversion = { error: errorMessage(error) };
    }

    return { schemaNames, selectedSchema, validation, conversion, example, exampleError };
  } finally {
    mongooseZod.hooks.removeAllHooks();
  }
}
