import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import type {SchemaOptions} from 'mongoose';
import {callHookSync} from './hooks.js';

export interface ToMongooseSchemaOptions extends SchemaOptions {
  plugins?: Array<(schema: mongoose.Schema, options?: any) => void>;
  validateBeforeSave?: boolean;
  /** Prefix used for Mongoose discriminator model names to avoid model-name collisions. */
  discriminatorModelPrefix?: string;
}

/**
 * DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including custom application flags.
 * We use a more permissive base to avoid recursive type checking issues with
 * complex Mongoose types in the registry and hooks.
 */
export interface MongooseMeta extends Record<string, any> {
  explicitId?: boolean;
  schema?: any;
  ref?: string;
  refSchema?: any;
}

/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
export const mongooseRegistry = z.registry<MongooseMeta>();

/**
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
export function withMongoose<T extends z.ZodTypeAny>(schema: T, meta: MongooseMeta = {}): T {
  callHookSync('registry:get:before', {schema});
  const existing = mongooseRegistry.get(schema) || {};
  callHookSync('registry:get', {schema, meta: existing});

  const merged = {...existing, ...meta};
  callHookSync('registry:add', {schema, meta: merged});
  mongooseRegistry.add(schema, merged);
  callHookSync('registry:added', {schema, meta: merged});
  return schema;
}

/**
 * Recursively collect Mongoose metadata from a Zod schema and its wrappers.
 */
export function getMongooseMeta(schema: z.ZodTypeAny): MongooseMeta {
  const def = (schema as any)._def;
  if (!def) return {};

  let meta = mongooseRegistry.get(schema) || {};

  // If it has an inner type (Optional, Nullable, Default, etc.), collect from it too
  if (def.innerType) {
    meta = {...getMongooseMeta(def.innerType), ...meta};
  } else if (def.schema) {
    meta = {...getMongooseMeta(def.schema), ...meta};
  }

  // Handle pipes (like z.codec)
  if (def.type === 'pipe') {
    // Collect from both 'in' and 'out' parts, preferring metadata from 'out' if it exists,
    // but the pipe itself usually holds the metadata we want.
    meta = {...getMongooseMeta(def.in), ...getMongooseMeta(def.out), ...meta};
  }

  return meta;
}
