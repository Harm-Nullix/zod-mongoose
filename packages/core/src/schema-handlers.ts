import {z} from 'zod/v4';
import {mongooseRegistry} from './registry.js';
import {unwrapZodSchema} from './zod-helpers.js';
import {getMongoose} from './config.js';
import {callHookSync} from './hooks.js';

/**
 * Handles ZodObject conversion to Mongoose Schema definition.
 */
export function handleObject(
  unwrapped: z.ZodObject<any>,
  mongooseProp: any,
  visited: Map<z.ZodTypeAny, any>,
  extractMongooseDef: (schema: z.ZodTypeAny, visited: Map<z.ZodTypeAny, any>) => any,
  isField = false,
) {
  callHookSync('schema:object:before', {schema: unwrapped, mongooseProp, visited});
  const {shape} = unwrapped;
  const objDef: any = {};

  // We must ensure recursive calls see the current object to break cycles.
  const placeholder = mongooseProp.type ? mongooseProp : objDef;
  visited.set(unwrapped, placeholder);

  // eslint-disable-next-line no-restricted-syntax
  for (const key in shape) {
    if (!Object.prototype.hasOwnProperty.call(shape, key)) continue;

    // Skip automatic _id mapping unless explicitly requested
    if (key === '_id') {
      const idMeta = mongooseRegistry.get(shape[key]) || {};
      const unwrappedId = unwrapZodSchema(shape[key]).schema;
      const unwrappedIdMeta = mongooseRegistry.get(unwrappedId) || {};
      if (
        idMeta.includeId !== true &&
        unwrappedIdMeta.includeId !== true &&
        mongooseProp.includeId !== true
      ) {
        continue;
      }
    }
    const def = extractMongooseDef(shape[key], visited);
    if (def && typeof def === 'object' && def.__isDiscriminatorUnion) {
      const mongoose = getMongoose();
      if (mongoose) {
        const baseSchema = new mongoose.Schema(def.baseDef, {
          discriminatorKey: def.discriminatorKey,
          _id: false,
        });
        const discriminators: Record<string, any> = {};
        for (const [dKey, dDef] of Object.entries(def.discriminators)) {
          discriminators[dKey] = new mongoose.Schema(dDef as any, {_id: false});
        }
        objDef[key] = {
          type: baseSchema,
          discriminators,
        };
      } else {
        objDef[key] = def;
      }
    } else if (typeof def === 'object' && def !== null && !Array.isArray(def)) {
      const {includeId, ...cleanDef} = def;
      objDef[key] = cleanDef;
    } else {
      objDef[key] = def;
    }
    callHookSync('schema:object:field', {key, schema: shape[key], objDef, visited});
  }

  // If the developer didn't provide a strict Mongoose type override, return the shape
  let result;

  // Handle explicit or default subschema request
  const shouldBeSubSchema = isField && mongooseProp.schema !== false;

  if (shouldBeSubSchema && !mongooseProp.type) {
    const mongoose = getMongoose();
    if (mongoose) {
      const options = typeof mongooseProp.schema === 'object' ? mongooseProp.schema : {};
      const {plugins, ...schemaOptions} = options as any;
      const subSchema = new mongoose.Schema(objDef, schemaOptions);

      if (plugins && Array.isArray(plugins)) {
        for (const plugin of plugins) {
          subSchema.plugin(plugin);
        }
      }
      mongooseProp.type = subSchema;
    }
  }

  if (mongooseProp.type) {
    const mongoose = getMongoose();
    const isSchema = mongoose && (mongooseProp.type instanceof mongoose.Schema || mongooseProp.type.constructor?.name === 'Schema');

    // If there is a type override, merge the object definition into the result unless it's a Schema
    if (!isSchema) {
      Object.assign(mongooseProp, objDef);
    }
    result = mongooseProp;
  } else {
    Object.assign(mongooseProp, objDef);

    const topLevelOptions = new Set([
      'collection',
      'versionKey',
      'timestamps',
      'discriminatorKey',
      'strict',
      'id',
      '_id',
      'minimize',
      'validateBeforeSave',
      'schema',
    ]);

    const hasFieldMetadata = Object.keys(mongooseProp).some((k) => {
      if (Object.prototype.hasOwnProperty.call(objDef, k)) return false;
      if (topLevelOptions.has(k)) return false;
      if (k === 'required' && mongooseProp[k] === false) return false;
      return true;
    });

    result = hasFieldMetadata ? mongooseProp : objDef;
  }

  callHookSync('schema:object:after', {schema: unwrapped, mongooseProp, objDef, result});
  return result;
}

/**
 * Handles ZodArray, ZodSet, and ZodTuple conversion.
 */
export function handleArray(
  unwrapped: z.ZodArray<any> | z.ZodSet<any> | z.ZodTuple<any>,
  mongooseProp: any,
  visited: Map<z.ZodTypeAny, any>,
  extractMongooseDef: (schema: z.ZodTypeAny, visited: Map<z.ZodTypeAny, any>) => any,
) {
  callHookSync('schema:array:before', {schema: unwrapped, mongooseProp, visited});
  const element =
    (unwrapped as any).element ||
    (unwrapped as any)._def.valueType ||
    (unwrapped as any)._def.rest ||
    (unwrapped as any)._def.items?.[0];

  const mongoose = getMongoose();
  const innerDef = element
    ? extractMongooseDef(element, visited)
    : mongoose?.Schema.Types.Mixed || 'Mixed';

  // If no explicit type override, wrap the inner definition in an array
  if (!mongooseProp.type) {
    if (innerDef && typeof innerDef === 'object' && innerDef.__isDiscriminatorUnion && mongoose) {
      // const baseSchema =
      // new mongoose.Schema(innerDef.baseDef, {
      //   discriminatorKey: innerDef.discriminatorKey,
      //   _id: false,
      // });
      const discriminators: Record<string, any> = {};
      for (const [dKey, dDef] of Object.entries(innerDef.discriminators)) {
        discriminators[dKey] = new mongoose.Schema(dDef as any, {_id: false});
      }
      mongooseProp.type = [
        new mongoose.Schema(
          {},
          {
            discriminatorKey: innerDef.discriminatorKey,
            _id: false,
          },
        ),
      ];
      mongooseProp.discriminators = discriminators;
    } else {
      const innerType = (innerDef as any).type || innerDef;
      mongooseProp.type = [innerType];

      // Transfer any metadata from the inner type (like 'ref') to the array definition
      if (typeof innerDef === 'object') {
        // eslint-disable-next-line sonarjs/no-unused-vars
        const {type: _extractedType, ...innerMeta} = innerDef;
        Object.assign(mongooseProp, innerMeta);
        mongooseProp.type = [innerType]; // Restore type as array
      }
    }
  }
  callHookSync('schema:array:after', {schema: unwrapped, mongooseProp, innerDef});
}

/**
 * Handles ZodRecord and ZodMap conversion.
 */
export function handleRecord(
  unwrapped: z.ZodRecord<any, any> | z.ZodMap<any, any>,
  mongooseProp: any,
  visited: Map<z.ZodTypeAny, any>,
  extractMongooseDef: (schema: z.ZodTypeAny, visited: Map<z.ZodTypeAny, any>) => any,
) {
  callHookSync('schema:record:before', {schema: unwrapped, mongooseProp, visited});
  const type = (unwrapped as any)._def?.type;
  const isMap = type === 'map';

  const valueType =
    (unwrapped as any).valueType ||
    (unwrapped as any).valueSchema ||
    (unwrapped as any)._def.valueType ||
    (unwrapped as any)._def.valueSchema ||
    (unwrapped as any)._def.innerType; // For some Zod versions
  let innerDef: any;

  if (!mongooseProp.type || mongooseProp.type === Map || mongooseProp.type === Object) {
    // z.record() maps to a POJO (Object/Mixed), while z.map() maps to a Mongoose Map
    mongooseProp.type = isMap ? Map : Object;
    const finalValueType =
      valueType || (unwrapped as any).valueSchema || (unwrapped as any)._def?.valueSchema;
    if (finalValueType) {
      innerDef = extractMongooseDef(finalValueType, visited);
      mongooseProp.of = (innerDef as any).type || innerDef;
    }
  }
  callHookSync('schema:record:after', {schema: unwrapped, mongooseProp, innerDef});
}
