import {z} from 'zod/v4';
import {withMongoose, MongooseMeta} from './registry.js';
import {ZRefBrand} from './mongoose-helpers.shared.js';
import type mongoose from 'mongoose'; // Type-only import

export * from './mongoose-helpers.shared.js';

const preprocessFn = (val: unknown) => (val === null ? undefined : val);

export const zObjectId = (options?: MongooseMeta) => withMongoose(
    z.preprocess(preprocessFn, z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')),
    {type: 'ObjectId', ...options},
  );

export const zBuffer = (options?: MongooseMeta) => withMongoose(z.instanceof(Uint8Array), {type: 'Buffer', ...options});

export const zRef = <T extends z.ZodTypeAny>(ref: string, schema: T, options?: MongooseMeta) => {
  const objectIdSchema = zObjectId();

  const base = z.codec(z.union([objectIdSchema, schema]), objectIdSchema as any, {
    decode: (val: any) => (typeof val === 'object' && val !== null && '_id' in val ? val._id : val),
    encode: (val: any) => val,
  });

  return withMongoose(base as any, {
    type: 'ObjectId',
    ref,
    refSchema: schema,
    ...options,
  }) as unknown as z.ZodType<(string | mongoose.Types.ObjectId) & Partial<ZRefBrand<T>>, any> &
    ZRefBrand<T>;
};
