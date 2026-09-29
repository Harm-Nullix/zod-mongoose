import type { ZodType } from "zod/v4";
import { getMongooseMeta } from "@nullix/zod-mongoose";

type Schema = ZodType & { _def: Record<string, any> };

function checks(schema: Schema): Record<string, any>[] {
  return (schema._def.checks || []).map((check: any) => check._zod?.def || check.def || {});
}

function sampleString(schema: Schema, key: string): string {
  const rules = checks(schema);
  const format = schema._def.format || rules.find((rule) => rule.format)?.format;
  if (format === "email" || /email/i.test(key)) return "alex@example.com";
  if (format === "uuid") return "123e4567-e89b-42d3-a456-426614174000";
  if (format === "url") return "https://example.com";
  if (format === "datetime") return "2026-01-01T12:00:00.000Z";
  if (format === "date") return "2026-01-01";

  const minimum = Math.max(1, ...rules.filter((rule) => rule.check === "min_length").map((rule) => rule.minimum));
  const base = /name/i.test(key) ? "Alex Morgan" : /title/i.test(key) ? "Example title" : "example";
  return base.padEnd(Math.min(minimum, 100), "x");
}

function sampleNumber(schema: Schema): number {
  const rules = checks(schema);
  const lower = rules.find((rule) => rule.check === "greater_than");
  const upper = rules.find((rule) => rule.check === "less_than");
  const integer = schema._def.type === "int" || rules.some((rule) => rule.check === "number_format" && rule.format === "safeint");
  const minimum = lower ? Number(lower.value) + (lower.inclusive ? 0 : integer ? 1 : 0.1) : 1;
  const maximum = upper ? Number(upper.value) - (upper.inclusive ? 0 : integer ? 1 : 0.1) : Infinity;
  const candidate = Math.min(Math.max(21, minimum), maximum);
  return integer ? Math.ceil(candidate) : candidate;
}

export function createExample(schema: Schema, key = "value", depth = 0, seen = new Set<Schema>()): unknown {
  if (depth > 8 || seen.has(schema)) throw new Error("This recursive schema needs a handwritten example.");
  const nextSeen = new Set(seen).add(schema);
  const def = schema._def;
  const mongooseType = getMongooseMeta(schema).type as any;
  if (mongooseType === "ObjectId" || mongooseType?.schemaName === "ObjectId") return "507f1f77bcf86cd799439011";

  switch (def.type) {
    case "optional":
    case "default":
    case "prefault":
      return depth === 0 ? createExample(def.innerType, key, depth + 1, nextSeen) : undefined;
    case "nullable":
    case "nonoptional":
    case "readonly":
    case "catch":
      return createExample(def.innerType, key, depth + 1, nextSeen);
    case "pipe":
      return createExample(def.in, key, depth + 1, nextSeen);
    case "lazy":
      return createExample(def.getter(), key, depth + 1, nextSeen);
    case "object": {
      const result: Record<string, unknown> = {};
      for (const [field, fieldSchema] of Object.entries((schema as any).shape || def.shape || {})) {
        const value = createExample(fieldSchema as Schema, field, depth + 1, nextSeen);
        if (value !== undefined) result[field] = value;
      }
      return result;
    }
    case "array": {
      const minimum = Math.max(0, ...checks(schema).filter((rule) => rule.check === "min_length").map((rule) => rule.minimum));
      return Array.from({ length: Math.min(Math.max(1, minimum), 10) }, () => createExample(def.element, key, depth + 1, nextSeen));
    }
    case "tuple": return def.items.map((item: Schema) => createExample(item, key, depth + 1, nextSeen));
    case "string": return sampleString(schema, key);
    case "number":
    case "int": return sampleNumber(schema);
    case "boolean": return true;
    case "enum": return Object.values(def.entries)[0];
    case "literal": return def.values?.[0];
    case "union": return createExample(def.options[0], key, depth + 1, nextSeen);
    case "record": return { example: createExample(def.valueType, key, depth + 1, nextSeen) };
    case "date": return "2026-01-01T12:00:00.000Z";
    default: throw new Error(`Automatic examples do not yet support ${def.type || "this schema"}.`);
  }
}
