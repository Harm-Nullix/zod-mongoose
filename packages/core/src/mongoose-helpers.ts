import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import {withMongoose, MongooseMeta} from './registry.js';
import {getMongoose} from './config.js';
import {ZRefBrand} from './mongoose-helpers.shared.js';

export * from './mongoose-helpers.shared.js';
const preprocessFn = (val: unknown) => (val === null ? undefined : val);
export const zObjectId = (options?: MongooseMeta) => {
  const mongooseInstance = getMongoose();

  const objectIdSchema = z.custom<mongoose.Types.ObjectId>(
    (val) => mongooseInstance && val instanceof mongooseInstance.Types.ObjectId,
  );

  const baseUnion = z.preprocess(
    preprocessFn,
    z.union([objectIdSchema, z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')]),
  );

  // Define the input type validation (Accepts ObjectId OR String)
  const inputSchema = z.codec(baseUnion, objectIdSchema, {
    decode: (val: any) => {
      if (!mongooseInstance) return val;

      // If it's already an instance, return it exactly as-is to preserve reference memory!
      if (val instanceof mongooseInstance.Types.ObjectId) {
        return val;
      }

      // Only construct a new one if it's a string representation
      return new mongooseInstance.Types.ObjectId(val);
    },
    encode: (val: typeof mongooseInstance.Types.ObjectId) => val.toString(),
  });

  // we force the type signature using an explicit cast on the returned Zod schema.
  return withMongoose(inputSchema, {
    type: mongooseInstance?.Schema.Types.ObjectId || 'ObjectId',
    ...options,
  });
};

export const zBuffer = (options?: MongooseMeta) => {
  const mongooseInstance = getMongoose();
  return withMongoose(
    z.custom<Buffer>(
      (val) => (mongooseInstance && val instanceof Buffer) || val instanceof Uint8Array,
    ),
    {type: mongooseInstance?.Schema.Types.Buffer || 'Buffer', ...options},
  );
};

export const zRef = <T extends z.ZodTypeAny>(ref: string, schema: T, options?: MongooseMeta) => {
  const mongooseInstance = getMongoose();
  const objectIdSchema = zObjectId();

  const base = z.codec(z.union([objectIdSchema, schema]), objectIdSchema as any, {
    decode: (val: any) => (typeof val === 'object' && val !== null && '_id' in val ? val._id : val),
    encode: (val: any) => val,
  });

  return withMongoose(base as any, {
    type: mongooseInstance?.Schema.Types.ObjectId || 'ObjectId',
    ref,
    refSchema: schema,
    ...options,
  }) as unknown as z.ZodType<(string | mongoose.Types.ObjectId) & Partial<ZRefBrand<T>>, any> &
    ZRefBrand<T>;
};
