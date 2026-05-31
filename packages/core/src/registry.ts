import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import type {SchemaOptions} from 'mongoose';
import {callHookSync} from './hooks.js';

export interface ToMongooseSchemaOptions extends SchemaOptions {
  plugins?: Array<(schema: mongoose.Schema, options?: any) => void>;
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
}

/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
export const mongooseRegistry = z.registry<MongooseMeta>();

/**
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
export function withMongoose<T extends z.ZodTypeAny>(schema: T, meta?: MongooseMeta): T {
  meta ??= {};
  callHookSync('registry:get:before', {schema});
  const existing = mongooseRegistry.get(schema) || {};
  callHookSync('registry:get', {schema, meta: existing});

  const merged = {...existing, ...meta};
  callHookSync('registry:add', {schema, meta: merged});
  mongooseRegistry.add(schema, merged);
  callHookSync('registry:added', {schema, meta: merged});
  return schema;
}
