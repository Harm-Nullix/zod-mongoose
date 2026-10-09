import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import type {SchemaOptions} from 'mongoose';
import {mongooseRegistry} from './registry.js';
import type {ToMongooseSchemaOptions} from './registry.js';
import {objectStrictness, unwrapZodSchema} from './zod-helpers.js';
import {prepareForZodValidation} from './zod-validation.js';
import {getMongoose} from './config.js';
import {extractMongooseDef} from './extract-mongoose-def.js';
import {callHookSync} from './hooks.js';
import type {
  SchemaTypeOptions,
  SchemaMetadata,
  MergeOptions,
  ConvertedDocument,
  SchemaHydratedDocument,
} from './schema-types.js';

export {extractMongooseDef} from './extract-mongoose-def.js';
export type {ToMongooseType} from './extract-mongoose-def.js';
export type {ToMongooseSchemaOptions} from './registry.js';

function modelNameFromCollection(collection: string): string {
  const singular = collection
    .replace(/ies$/i, 'y')
    .replace(/(ses|xes|zes|ches|shes)$/i, (suffix) => suffix.slice(0, -2))
    .replace(/s$/i, '');
  return singular.slice(0, 1).toUpperCase() + singular.slice(1);
}

/**
 * Converts a Zod schema to a Mongoose Schema instance.
 */
export function toMongooseSchema<
  T extends z.ZodTypeAny,
  TInstanceMethods = {},
  TQueryHelpers = {},
  TStaticMethods = {},
  TVirtuals = {},
  THydratedDocumentType = mongoose.HydratedDocument<
    z.infer<T>,
    TVirtuals & TInstanceMethods,
    TQueryHelpers
  >,
  TModelType = mongoose.Model<
    z.infer<T>,
    TQueryHelpers,
    TInstanceMethods,
    TVirtuals,
    THydratedDocumentType
  >,
  const TOptions extends SchemaTypeOptions = {},
>(
  schema: T,
  options?: ToMongooseSchemaOptions<
    z.infer<T>,
    TInstanceMethods,
    TQueryHelpers,
    TStaticMethods,
    TVirtuals,
    THydratedDocumentType,
    TModelType
  > &
    TOptions,
): mongoose.Schema<
  ConvertedDocument<T, MergeOptions<SchemaMetadata<T>, NoInfer<TOptions>>>,
  TModelType,
  TInstanceMethods,
  TQueryHelpers,
  TVirtuals,
  TStaticMethods,
  MergeOptions<mongoose.DefaultSchemaOptions, MergeOptions<SchemaMetadata<T>, NoInfer<TOptions>>>,
  mongoose.InferSchemaType<
    mongoose.Schema<
      ConvertedDocument<T, MergeOptions<SchemaMetadata<T>, NoInfer<TOptions>>>,
      any,
      any,
      any,
      any,
      any,
      MergeOptions<
        mongoose.DefaultSchemaOptions,
        MergeOptions<SchemaMetadata<T>, NoInfer<TOptions>>
      >
    >
  >,
  SchemaHydratedDocument<
    THydratedDocumentType & TInstanceMethods & TVirtuals,
    z.infer<T>,
    MergeOptions<SchemaMetadata<T>, NoInfer<TOptions>>,
    TVirtuals
  >
> {
  const {schema: unwrapped} = unwrapZodSchema(schema);
  const meta =
    mongooseRegistry.get(schema) ||
    mongooseRegistry.get(unwrapped) ||
    (schema as any).meta?.() ||
    (unwrapped as any).meta?.() ||
    {};

  const {plugins, modelName, ...schemaOptions} = options || {};

  const mergedOptions: SchemaOptions<
    z.infer<T>,
    TInstanceMethods,
    TQueryHelpers,
    TStaticMethods,
    TVirtuals,
    THydratedDocumentType,
    TModelType
  > = {
    ...(unwrapped instanceof z.ZodObject ? {strict: objectStrictness(unwrapped)} : {}),
    ...(unwrapped instanceof z.ZodObject && objectStrictness(unwrapped) === false
      ? {minimize: false}
      : {}),
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
    const baseModelName =
      modelName || (options?.collection && modelNameFromCollection(options.collection));
    if (!baseModelName) {
      throw new Error(
        'toMongooseSchema() found a top-level discriminated union. ' +
          'Provide `modelName` or `collection` so discriminator model names can be made unique, ' +
          "for example `{ modelName: 'Activity' }`.",
      );
    }

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
      const discriminatorModelName = `${baseModelName}_${key}`;
      if (mongooseSchema.discriminators && mongooseSchema.discriminators[discriminatorModelName]) {
        continue;
      }
      mongooseSchema.discriminator(
        discriminatorModelName,
        new mongoose.Schema(dDef as any, {_id: false}),
        {value: key},
      );
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

  if (mergedOptions.validateBeforeSave !== false) {
    mongooseSchema.post('validate', function () {
      try {
        schema.parse(prepareForZodValidation(schema, this.toObject(), mongooseSchema));
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
      // The dynamic schema definition is erased internally; the public callback retains its types.
      mongooseSchema.plugin(plugin as (schema: mongoose.Schema) => void);
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
