import {z} from 'zod/v4';
import {getMongooseMeta, mongooseRegistry} from './registry.js';

/** Build a validator for persisted output without executing input transforms. */
export function storageSchema(
  schema: z.ZodType,
  seen = new Map<z.ZodType, z.ZodType>(),
): z.ZodType {
  if (seen.has(schema)) return seen.get(schema)!;
  seen.set(schema, schema);
  const def = (schema as any)._def;
  if (!def) return schema;

  // References deliberately accept both populated documents and IDs. Their
  // package-owned codec projects the ID without changing the stored document.
  if (mongooseRegistry.get(schema)?.refSchema) return schema;

  const child = (value: z.ZodType) => storageSchema(value, seen);
  let result: z.ZodType;
  if (def.type === 'pipe' || def.type === 'transform') {
    result = def.type === 'pipe' ? child(def.out) : z.unknown();
    if (def.checks?.length) result = result.check(...def.checks);
  } else {
    const next = {...def};
    switch (def.type) {
      case 'object': {
        next.shape = Object.fromEntries(
          Object.entries(def.shape).map(([key, value]) => [key, child(value as z.ZodType)]),
        );
        if (def.catchall) next.catchall = child(def.catchall);
        break;
      }
      case 'array': {
        next.element = child(def.element);
        break;
      }
      case 'tuple': {
        next.items = def.items.map(child);
        if (def.rest) next.rest = child(def.rest);
        break;
      }
      case 'union':
      case 'xor': {
        next.options = def.options.map(child);
        break;
      }
      case 'intersection': {
        next.left = child(def.left);
        next.right = child(def.right);
        break;
      }
      case 'record':
      case 'map': {
        next.keyType = child(def.keyType);
        next.valueType = child(def.valueType);
        break;
      }
      case 'set': {
        next.valueType = child(def.valueType);
        break;
      }
      case 'lazy': {
        next.getter = () => child(def.getter());
        break;
      }
      default: {
        if (def.innerType) next.innerType = child(def.innerType);
      }
    }
    result = schema.clone(next);
  }

  // Metadata on input schemas and their wrappers also describes the stored path.
  mongooseRegistry.add(result, {...getMongooseMeta(schema)});
  seen.set(schema, result);
  return result;
}
