import {z} from 'zod/v4';
import {getMongoose} from './config.js';
import {unwrapZodSchema} from './zod-helpers.js';
import {mongooseRegistry, getMongooseMeta} from './registry.js';
import {mapZodChecksToMongoose} from './validation-mappers.js';
import {handleObject, handleArray, handleRecord} from './schema-handlers.js';
import {callHookSync} from './hooks.js';

/**
 * Compare generated Mongoose definitions without walking Mongoose's internal
 * Schema object, which contains cyclic references.
 */
function areDefinitionsEqual(
  left: any,
  right: any,
  seen: WeakMap<object, WeakSet<object>> = new WeakMap(),
): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  const mongoose = getMongoose();
  const leftIsSchema = mongoose && left instanceof mongoose.Schema;
  const rightIsSchema = mongoose && right instanceof mongoose.Schema;

  if (leftIsSchema || rightIsSchema) {
    return Boolean(
      leftIsSchema &&
        rightIsSchema &&
        areDefinitionsEqual(left.obj, right.obj, seen),
    );
  }

  let seenRight = seen.get(left);
  if (seenRight?.has(right)) return true;
  if (!seenRight) {
    seenRight = new WeakSet();
    seen.set(left, seenRight);
  }
  seenRight.add(right);

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areDefinitionsEqual(value, right[index], seen))
    );
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(right, key) && areDefinitionsEqual(left[key], right[key], seen),
    )
  );
}

/**
 * Type-level mapping from Zod to Mongoose Schema Definitions
 */
export type ToMongooseType<T extends z.ZodTypeAny> = (
  T extends z.ZodObject<infer Shape>
    ? {[K in keyof Shape]: Shape[K] extends z.ZodTypeAny ? ToMongooseType<Shape[K]> : any}
    : T extends z.ZodArray<infer Element>
      ? Element extends z.ZodTypeAny
        ? Array<ToMongooseType<Element>> | {type: Array<any>; [key: string]: any}
        : Array<any>
      : T extends z.ZodOptional<infer Inner>
        ? Inner extends z.ZodTypeAny
          ? ToMongooseType<Inner>
          : any
        : T extends z.ZodDefault<infer Inner>
          ? Inner extends z.ZodTypeAny
            ? ToMongooseType<Inner>
            : any
          : T extends z.ZodNullable<infer Inner>
            ? Inner extends z.ZodTypeAny
              ? ToMongooseType<Inner>
              : any
            : any
) & Record<string, any>;

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
export function extractMongooseDef<T extends z.ZodTypeAny>(
  schema: T,
  visited: Map<z.ZodTypeAny, any> = new Map(),
  isField = false,
  noWrap = false,
): ToMongooseType<T> {
  // Only call converter:before at the very beginning of a run
  if (visited.size === 0) {
    callHookSync('converter:before', {schema: schema as z.ZodTypeAny, visited});
  }
  callHookSync('converter:start', {schema: schema as z.ZodTypeAny, visited});

  const {schema: unwrapped, features} = unwrapZodSchema(schema);

  // Pull any explicitly registered Mongoose metadata (including from wrappers)
  const meta = mongooseRegistry.get(schema) || {};
  const mongooseProp: any = getMongooseMeta(schema);

  callHookSync('converter:unwrapped', {
    schema: schema as z.ZodTypeAny,
    unwrapped,
    features,
    meta: mongooseProp,
    mongooseProp: mongooseProp as any,
  });

  if (features.isOptional === true && mongooseProp.type && mongooseProp.required !== true) {
    mongooseProp.required = false;
  }

  if (visited.has(schema)) {
    const existing = visited.get(schema);
    if (existing === mongooseProp) {
      return existing as any;
    }
    // console.log('Visited CACHE for', (unwrapped as any)._def.type, existing);
    if (Object.keys(meta).length > 0) {
      Object.assign(existing, mongooseProp);
    }
    return existing as any;
  }

  visited.set(schema, mongooseProp);
  // console.log('Visited set for', (unwrapped as any)._def.type, mongooseProp);

  if (features.default !== undefined) {
    mongooseProp.default = features.default;
  }
  if (features.required === false) {
    mongooseProp.required = false;
  }
  if (features.readOnly === true) {
    mongooseProp.readOnly = true;
  }

  // Map Zod checks to Mongoose options
  mapZodChecksToMongoose(features.checks, mongooseProp);

  const def = (unwrapped as any)._def;
  if (!def) {
    callHookSync('converter:after', {
      schema: schema as z.ZodTypeAny,
      mongooseProp,
    });
    return mongooseProp;
  }
  const {type} = def;

  callHookSync('converter:node', {
    schema: unwrapped,
    mongooseProp,
    type,
  });

  // Handle recursion and specific types via separate handlers
  if (type === 'object') {
    const wrapperFn = (s: z.ZodTypeAny, v: Map<z.ZodTypeAny, any>) =>
      extractMongooseDef(s, v, true);
    const result = handleObject(unwrapped as any, mongooseProp, visited, wrapperFn, isField && !noWrap);
    callHookSync('converter:after', {
      schema: schema as z.ZodTypeAny,
      mongooseProp: result,
    });
    if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
      delete result.includeId;
    }
    return result;
  }

  if (type === 'array' || type === 'set' || type === 'tuple') {
    handleArray(unwrapped as any, mongooseProp, visited, (s, v) => extractMongooseDef(s, v, true));
  }

  if (type === 'record' || type === 'map') {
    handleRecord(unwrapped as any, mongooseProp, visited, (s, v) => extractMongooseDef(s, v, true));
  }

  // Handle Intersections
  if (type === 'intersection') {
    const left = extractMongooseDef((unwrapped as any)._def.left, visited, isField, true);
    const right = extractMongooseDef((unwrapped as any)._def.right, visited, isField, true);

    if (typeof left === 'object' && typeof right === 'object') {
      Object.assign(mongooseProp, left, right);

      if (isField && !noWrap && mongooseProp.schema !== false && !mongooseProp.type) {
        const mongoose = getMongoose();
        if (mongoose) {
          const options = typeof mongooseProp.schema === 'object' ? mongooseProp.schema : {};
          const {plugins, ...schemaOptions} = options as any;
          const definition = {...mongooseProp};
          // Remove metadata fields that shouldn't be in the schema definition if they are top-level
          delete definition.schema;

          const subSchema = new mongoose.Schema(definition, schemaOptions);

          if (plugins && Array.isArray(plugins)) {
            for (const plugin of plugins) {
              subSchema.plugin(plugin);
            }
          }
          mongooseProp.type = subSchema;

          // Clear other fields since they are now in subSchema
          for (const key of Object.keys(mongooseProp)) {
            if (key !== 'type') delete mongooseProp[key];
          }
        }
      }
    } else if (!mongooseProp.type) {
      mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
    }
  }

  if (
    (type === 'union' ||
      type === 'discriminatedunion' ||
      type === 'discriminated_union' ||
      type === 'xor') &&
    !mongooseProp.type
  ) {
    const mongoose = getMongoose();
    const options = (unwrapped as any).options || (unwrapped as any)._def.options;
    const discriminatorKey = (unwrapped as any)._def.discriminator;
    const unionCtx = {
      isSimpleUnion: false,
      isObjectUnion: false,
      isXor:
        type === 'xor' ||
        (((unwrapped as any)._def?.inclusive === false ||
          (schema as any)._def?.inclusive === false) &&
          !discriminatorKey &&
          !(schema as any)._def?.discriminator),
    };

    if (Array.isArray(options) && options.length > 0) {
      unionCtx.isSimpleUnion = options.every((opt) => {
        const {type} = unwrapZodSchema(opt).schema._def;
        return ['string', 'number', 'boolean', 'date', 'bigint', 'literal'].includes(type);
      });

      unionCtx.isObjectUnion = options.every((opt) => {
        const {type} = unwrapZodSchema(opt).schema._def;
        return type === 'object';
      });
    }

    callHookSync('schema:union:before', {schema: unwrapped as any, mongooseProp, ctx: unionCtx});

    if (discriminatorKey && unionCtx.isObjectUnion) {
      const discriminators: Record<string, any> = {};
      const allOptionDefs: Array<Record<string, any>> = [];

      for (const option of options) {
        const {schema: unwrappedOpt} = unwrapZodSchema(option);
        const {shape} = (unwrappedOpt as any)._def;
        const discriminatorProp = shape[discriminatorKey];
        // Support both ZodLiteral and ZodOptional/ZodDefault/ZodNullable wrapped literals
        const {schema: unwrappedDisc} = unwrapZodSchema(discriminatorProp);
        const discriminatorValue =
          (unwrappedDisc as any)._def.value ?? (unwrappedDisc as any)._def.values?.[0];

        // Use a fresh Map for each option to avoid cross-contamination of visited nodes
        const optionDef = extractMongooseDef(option, new Map(), true, true);
        if (optionDef && typeof optionDef === 'object' && !Array.isArray(optionDef)) {
          const cleanOptionDef = {...optionDef};
          delete cleanOptionDef[discriminatorKey];
          discriminators[discriminatorValue] = cleanOptionDef;
          allOptionDefs.push(cleanOptionDef);
        }
      }

      // Identify common fields present in ALL options to move to baseDef
      const baseDef: Record<string, any> = {};
      if (allOptionDefs.length > 0) {
        const firstOption = allOptionDefs[0];
        for (const key of Object.keys(firstOption)) {
          const isCommon = allOptionDefs.every((def) => {
            if (!(key in def)) return false;
            // Simple check for equality of definitions (can be improved)
            return areDefinitionsEqual(def[key], firstOption[key]);
          });

          if (isCommon) {
            baseDef[key] = firstOption[key];
            // Remove from discriminators to avoid duplication
            for (const def of allOptionDefs) {
              delete def[key];
            }
          }
        }
      }

      const result = {
        __isDiscriminatorUnion: true,
        discriminatorKey,
        discriminators,
        baseDef,
        validate: {
          validator(_v: any) {
            try {
              // Ensure we include the discriminator key in the object being validated
              const mongoose = getMongoose();
              const doc =
                mongoose && this instanceof mongoose.Document ? this.toObject() : this || {};
              (schema as any).parse(doc);
              return true;
            } catch (err: any) {
              const message = err?.errors?.[0]?.message || err.message;
              if (this && typeof this.invalidate === 'function') {
                this.invalidate(discriminatorKey, `Zod validation failed: ${message}`);
              }
              return false;
            }
          },
          message: (props: any) => `Validation failed for ${props.path}`,
        },
      };

      // If this is wrapped in a meta object, ensure we return the result properly
      if (mongooseProp && typeof mongooseProp === 'object' && !Array.isArray(mongooseProp)) {
        Object.assign(mongooseProp, result);
        callHookSync('schema:union:after', {
          schema: unwrapped as any,
          mongooseProp,
          ctx: unionCtx,
        });
        return mongooseProp;
      }

      callHookSync('schema:union:after', {
        schema: unwrapped as any,
        mongooseProp: result,
        ctx: unionCtx,
      });

      return result as any;
    }

    if (
      getMongoose()?.Schema.Types.Union &&
      unionCtx.isSimpleUnion &&
      options.length > 0 &&
      !unionCtx.isXor
    ) {
      mongooseProp.type = mongoose.Schema.Types.Union;
      mongooseProp.of = options.map((opt: any) => {
        const def = extractMongooseDef(opt, visited, true, true);
        return (def as any).type || (def as any);
      });
    } else if (unionCtx.isObjectUnion && options.length > 0) {
      // Merge all object properties into a single schema object
      const mergedDef: any = {};
      for (const opt of options) {
        const def = extractMongooseDef(opt, new Map(), true, true);
        if (typeof def === 'object' && def !== null) {
          for (const [key, prop] of Object.entries(def)) {
            if (typeof prop === 'object' && prop !== null && !Array.isArray(prop)) {
              (prop as any).required = false;
            }
            if (
              mergedDef[key] &&
              typeof mergedDef[key] === 'object' &&
              typeof prop === 'object' &&
              !Array.isArray(mergedDef[key]) &&
              !Array.isArray(prop)
            ) {
              const existingType =
                (mergedDef[key] as any).type ||
                (mergedDef[key] as any).instance ||
                (typeof mergedDef[key] === 'function' ? mergedDef[key] : null);
              const newType =
                (prop as any).type ||
                (prop as any).instance ||
                (typeof prop === 'function' ? prop : null);
              const isMixed = (t: any) =>
                !t ||
                t === 'Mixed' ||
                t === 'SchemaMixed' ||
                t?.name === 'Mixed' ||
                t?.instance === 'Mixed' ||
                t?.name === 'SchemaMixed' ||
                t?.instance === 'SchemaMixed' ||
                (getMongoose()?.Schema.Types.Mixed &&
                  (t === getMongoose()?.Schema.Types.Mixed ||
                    t?.instance === 'Mixed' ||
                    t?.instance === 'SchemaMixed'));

              if (isMixed(existingType) && !isMixed(newType)) {
                mergedDef[key] = prop;
              } else if (!isMixed(existingType) && isMixed(newType)) {
                // Keep existing
              } else {
                Object.assign(mergedDef[key], prop);
              }
            } else if (
              !mergedDef[key] ||
              typeof mergedDef[key] !== 'object' ||
              Array.isArray(mergedDef[key])
            ) {
              mergedDef[key] = prop;
            }
          }
        }
      }

      if (isField && unionCtx.isXor) {
        // For nested XOR, always use Mixed with validator to ensure mutual exclusivity
        mongooseProp.type = mongoose?.Schema.Types.Mixed || 'Mixed';
        mongooseProp.validate = {
          validator(v: any) {
            try {
              (schema as any).parse(v);
              return true;
            } catch {
              return false;
            }
          },
          message: 'XOR validation failed',
        };
      } else {
        // For root or other object unions, merge properties
        if (
          !mongooseProp.type ||
          mongooseProp.type === (getMongoose()?.Schema.Types.Mixed || 'Mixed')
        ) {
          delete mongooseProp.type;
        }
        Object.assign(mongooseProp, mergedDef);
        // If the object contains a 'type' property, Mongoose might misinterpret it as a field definition.
        // We can hint that it's a nested object by using a Schema if 'type' is present along with other fields.
        if (
          isField &&
          Object.prototype.hasOwnProperty.call(mongooseProp, 'type') &&
          Object.keys(mongooseProp).length > 1
        ) {
          const mongooseInstance = getMongoose();
          if (mongooseInstance) {
            mongooseProp.type = new mongooseInstance.Schema(mongooseProp, {_id: false});
            for (const key of Object.keys(mongooseProp)) {
              if (key !== 'type') delete mongooseProp[key];
            }
          }
        }
      }
    } else {
      mongooseProp.type = mongoose?.Schema.Types.Mixed || 'Mixed';
      if (
        isField &&
        (type === 'xor' ||
          type === 'discriminated_union' ||
          type === 'discriminatedunion' ||
          type === 'union') &&
        !mongooseProp.ref && // Skip Zod validation for populated fields
        !Array.isArray(mongooseProp.type) && // Skip Zod validation for arrays
        mongooseProp.type !== Map && // Skip Zod validation for maps
        !mongooseProp.of // Skip Zod validation for collections
      ) {
        mongooseProp.validate = {
          validator(v: any) {
            try {
              (schema as any).parse(v);
              return true;
            } catch (err) {
              return false;
            }
          },
          message: (props: any) => {
            if (unionCtx.isXor) return 'XOR validation failed';
            try {
              (schema as any).parse(props.value);
            } catch (err: any) {
              return `Union validation failed: ${err.message}`;
            }
            return 'Union validation failed';
          },
        };
      }
    }

    callHookSync('schema:union:after', {
      schema: unwrapped as any,
      mongooseProp,
      ctx: unionCtx,
    });
  }

  if (type === 'literal' && !mongooseProp.type) {
    mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
  }

  // Handle Primitives
  switch (type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'date':
    case 'bigint':
    case 'stringbool':
    case 'boolstring':
    case 'booleanstring': {
      if (!mongooseProp.type) {
        if (type === 'bigint') {
          mongooseProp.type = typeof BigInt === 'undefined' ? Number : BigInt;
        } else {
          const typeMap: Record<string, any> = {
            string: String,
            number: Number,
            boolean: Boolean,
            date: Date,
            stringbool: Boolean,
            boolstring: Boolean,
            booleanstring: Boolean,
          };
          mongooseProp.type = typeMap[type];

          // Clever inference: If a transform occurred (which we know if the Zod type
          // is different from the default value type), prefer the default's type.
          if (mongooseProp.default !== undefined) {
            const defaultType = typeof mongooseProp.default;
            if (defaultType === 'boolean' && type !== 'boolean') {
              mongooseProp.type = Boolean;
            } else if (defaultType === 'number' && type !== 'number') {
              mongooseProp.type = Number;
            } else if (defaultType === 'string' && type !== 'string') {
              mongooseProp.type = String;
            } else if (mongooseProp.default instanceof Date && type !== 'date') {
              mongooseProp.type = Date;
            }
          }

          // Even cleverer: Check transformations for clues (e.g., stringbool, boolstring)
          if (mongooseProp.type === String && features.transformations) {
            for (const tx of features.transformations) {
              const txStr = tx.transform?.toString() || tx.toString();
              if (txStr.includes('stringbool') || txStr.includes('boolstring') || txStr.includes('booleanstring')) {
                mongooseProp.type = Boolean;
                break;
              }
              if (txStr.includes('=== "true"') || txStr.includes('=== \'true\'')) {
                mongooseProp.type = Boolean;
                break;
              }
            }
          }
        }
      }
      if (mongooseProp.required !== false) mongooseProp.required = true;
      break;
    }
    case 'enum':
    case 'nativeenum':
    case 'native_enum': {
      if (!mongooseProp.type) mongooseProp.type = String;
      mongooseProp.enum =
        type === 'enum'
          ? (unwrapped as any).options || def.values
          : Object.values((unwrapped as any).enum || def.values);
      if (mongooseProp.required !== false) mongooseProp.required = true;
      break;
    }
    default:
    // Do nothing
  }

  // Handle Specialized Types (Buffer, ObjectId)
  const mongooseInstance = getMongoose();
  if (type === 'any' || type === 'unknown' || type === 'custom') {
    const cls = def.cls || (unwrapped as any).cls;
    if (cls === Buffer || (typeof Uint8Array !== 'undefined' && cls === Uint8Array)) {
      if (!mongooseProp.type) mongooseProp.type = mongooseInstance?.Schema.Types.Buffer || 'Buffer';
    } else if (
      (cls?.name === 'ObjectId' || (mongooseInstance && cls === mongooseInstance.Types.ObjectId)) &&
      !mongooseProp.type
    ) {
      mongooseProp.type = mongooseInstance?.Schema.Types.ObjectId || 'ObjectId';
    }
  }

  // Handle Lazy (Recursion Support)
  if (type === 'lazy') {
    const inner = def.getter();
    const result = extractMongooseDef(inner, visited, isField);
    if (Object.keys(meta).length > 0 && result !== mongooseProp) {
      if (typeof result === 'object' && !Array.isArray(result)) {
        Object.assign(mongooseProp, result);
      } else {
        mongooseProp.type = (result as any).type || result;
      }
      return mongooseProp as any;
    }
    return result as any;
  }

  // Fallback for z.any() or unhandled types
  if (!mongooseProp.type && type !== 'object') {
    mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
  }

  callHookSync('converter:after', {
    schema: schema as z.ZodTypeAny,
    mongooseProp,
  });

  if (typeof mongooseProp === 'object' && mongooseProp !== null && !Array.isArray(mongooseProp)) {
    delete mongooseProp.includeId;
  }

  return mongooseProp;
}
