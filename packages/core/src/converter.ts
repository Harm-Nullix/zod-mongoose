import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import type {SchemaOptions} from 'mongoose';
import {mongooseRegistry} from './registry.js';
import type {ToMongooseSchemaOptions} from './registry.js';
import {unwrapZodSchema} from './zod-helpers.js';
import {getMongoose} from './config.js';
import {extractMongooseDef} from './extract-mongoose-def.js';
import {callHookSync} from './hooks.js';

export {extractMongooseDef} from './extract-mongoose-def.js';
export type {ToMongooseType} from './extract-mongoose-def.js';
export type {ToMongooseSchemaOptions} from './registry.js';

/**
 * Converts a Zod schema to a Mongoose Schema instance.
 */
export function toMongooseSchema<T extends z.ZodTypeAny>(
  schema: T,
  options?: ToMongooseSchemaOptions,
): mongoose.Schema<z.infer<T>> {
  const {schema: unwrapped} = unwrapZodSchema(schema);
  const meta =
    mongooseRegistry.get(schema) ||
    mongooseRegistry.get(unwrapped) ||
    (schema as any).meta?.() ||
    (unwrapped as any).meta?.() ||
    {};

  const {plugins, ...schemaOptions} = options || {};

  const mergedOptions: SchemaOptions = {
    // Also merge other schema options from meta if they exist
    ...(meta.collection ? {collection: meta.collection} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.strict !== undefined ? {strict: meta.strict} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.minimize !== undefined ? {minimize: meta.minimize} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.validateBeforeSave !== undefined ? {validateBeforeSave: meta.validateBeforeSave} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.versionKey !== undefined ? {versionKey: meta.versionKey} : {}),
    ...(meta.id === undefined ? {} : {id: meta.id}),
    ...(meta._id === undefined ? {} : {_id: meta._id}),
    ...(meta.timestamps ? {timestamps: meta.timestamps} : {}),
    ...(meta.discriminatorKey ? {discriminatorKey: meta.discriminatorKey} : {}),
    ...schemaOptions,
  };

  let definition = extractMongooseDef(schema, new Map(), false) as any;

  const mongoose = getMongoose();

  if (!mongoose) {
    throw new Error(
      'Mongoose must be installed to use toMongooseSchema. If you are in an ESM environment, ensure mongoose is loaded.',
    );
  }

  let mongooseSchema: mongoose.Schema;

  if (definition && typeof definition === 'object' && definition.__isDiscriminatorUnion) {
    const {discriminatorKey, discriminators, baseDef, validate} = definition;
    mongooseSchema = new mongoose.Schema(baseDef, {
      ...mergedOptions,
      discriminatorKey,
    });

    if (validate) {
      if (!mongooseSchema.path(discriminatorKey)) {
        mongooseSchema.add({[discriminatorKey]: {type: String}});
      }
      mongooseSchema.path(discriminatorKey).validate(validate);
    }

    for (const [key, dDef] of Object.entries(discriminators)) {
      if (mongooseSchema.discriminators && mongooseSchema.discriminators[key]) {
        continue;
      }
      mongooseSchema.discriminator(key, new mongoose.Schema(dDef as any, {_id: false}));
    }
  } else {
    // Strip internal includeId metadata that might have leaked into the definition
    if (typeof definition === 'object' && definition !== null) {
      // If it's a top-level object, it might have metadata fields directly
      const {includeId, ...cleanDefinition} = definition as any;
      definition = cleanDefinition;

      // Also clean any top-level field definitions
      for (const value of Object.values(definition)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          delete (value as any).includeId;
        }
      }
    }

    mongooseSchema = new mongoose.Schema(definition, mergedOptions);
  }

  if(mergedOptions.validateBeforeSave !== false){
    mongooseSchema.post('validate', function () {
      try {
        schema.parse(this.toObject());
      } catch (e) {
        if (e instanceof z.ZodError) {
          e.message = JSON.stringify({
            context: {
              model:
                (this.constructor as mongoose.Model<any>)?.modelName ||
                this.constructor?.name ||
                '_unknown_',
              id: this._id?.toString() || this.id?.toString() || '_unknown_',
            },
            errors: (e as any).issues || (e as any).errors || [],
          });
        }
        throw e;
      }
    });
  }

  // Apply plugins if provided in options
  if (plugins && Array.isArray(plugins)) {
    for (const plugin of plugins) {
      mongooseSchema.plugin(plugin);
    }
  }

  // Call schema:created hook
  callHookSync('schema:created', {
    schema,
    mongooseSchema,
    options: mergedOptions,
  });

  return mongooseSchema as any;
}
