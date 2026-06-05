import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import {withMongoose, MongooseMeta, getMongooseMeta} from './registry.js';
import {getFrontendMode, getMongoose} from './config.js';
import {unwrapZodSchema} from './zod-helpers.js';

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

export const zObjectId = (options?: MongooseMeta) => {
  if (getFrontendMode()) {
    return withMongoose(
      z.preprocess(
        (val) => (val === null ? undefined : val),
        z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId'),
      ),
      {
        type: 'ObjectId', // String representation for metadata
        ...options,
      },
    );
  }

  const mongoose = getMongoose();

  return withMongoose(
    z.preprocess(
      (val) => (val === null ? undefined : val),
      z.custom<mongoose.Types.ObjectId>(
        (val) =>
          (mongoose && val instanceof mongoose.Types.ObjectId) ||
          (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)),
      ),
    ),
    {
      type: mongoose?.Schema.Types.ObjectId || 'ObjectId',
      ...options,
    },
  );
};

export const zBuffer = (options?: MongooseMeta) => {
  if (getFrontendMode()) {
    return withMongoose(z.instanceof(Uint8Array), {
      type: 'Buffer',
      ...options,
    });
  }

  const mongoose = getMongoose();

  return withMongoose(
    z.custom<Buffer>((val) => (mongoose && val instanceof Buffer) || val instanceof Uint8Array),
    {
      type: mongoose?.Schema.Types.Buffer || 'Buffer',
      ...options,
    },
  );
};

export type ZRefBrand<S extends z.ZodTypeAny> = {
  _isZRef: true;
  _refSchema: S;
};

type UnwrapZRef<T> = T extends {_isZRef: true; _refSchema: infer R}
  ? R extends z.ZodTypeAny
    ? z.infer<R>
    : T
  : T extends {_isZRef?: true; _refSchema?: infer R}
    ? NonNullable<R> extends z.ZodTypeAny
      ? z.infer<NonNullable<R>>
      : T
    : T extends z.ZodOptional<infer U>
      ? UnwrapZRef<U> | undefined
      : T extends z.ZodNullable<infer U>
        ? UnwrapZRef<U> | null
        : T extends z.ZodArray<infer U>
          ? Array<UnwrapZRef<U>>
          : T extends Array<infer U>
            ? Array<UnwrapZRef<U>>
            : T extends z.ZodDefault<infer U>
              ? UnwrapZRef<U>
              : T extends z.ZodObject<infer Shape>
                ? {[P in keyof Shape]: UnwrapZRef<Shape[P]>}
                : T extends z.ZodType<any, any, any>
                  ? z.infer<T>
                  : T;

type UnwrapZRefSchema<T> = T extends {_isZRef: true; _refSchema: infer R}
  ? R extends z.ZodTypeAny
    ? R
    : T
  : T extends {_isZRef?: true; _refSchema?: infer R}
    ? NonNullable<R> extends z.ZodTypeAny
      ? NonNullable<R>
      : T
    : T extends z.ZodOptional<infer U>
      ? z.ZodOptional<UnwrapZRefSchema<U>>
      : T extends z.ZodNullable<infer U>
        ? z.ZodNullable<UnwrapZRefSchema<U>>
        : T extends z.ZodArray<infer U>
          ? z.ZodArray<UnwrapZRefSchema<U>>
          : T extends z.ZodObject<infer Shape>
            ? z.ZodObject<{[P in keyof Shape]: UnwrapZRefSchema<Shape[P]>}>
            : T;

export const zRef = <T extends z.ZodTypeAny>(ref: string, schema: T, options?: MongooseMeta) => {
  const isFrontend = getFrontendMode();

  const mongoose = getMongoose();

  const objectIdSchema = zObjectId();

  const base = z.codec(z.union([objectIdSchema, schema]), objectIdSchema as any, {
    decode: (val: any) => (typeof val === 'object' && val !== null && '_id' in val ? val._id : val),
    encode: (val: any) => val,
  });

  const result = withMongoose(base as any, {
    type: isFrontend ? 'ObjectId' : mongoose?.Schema.Types.ObjectId || 'ObjectId',
    ref,
    refSchema: schema,
    ...options,
  });

  return result as unknown as z.ZodType<
    z.output<typeof objectIdSchema> & Partial<ZRefBrand<T>>,
    any
  > &
    ZRefBrand<T>;
};

/**
 * Helper to create a populated version of a Zod schema.
 * Replaces zRef fields with their corresponding refSchema.
 * If no keys are provided, it attempts to populate all zRef fields.
 */
export function populateZodSchema<S extends z.ZodObject<any>, K extends keyof S['shape']>(
  schema: S,
  keys?: K[],
) {
  const {shape} = schema;
  const newShape: any = {...shape};
  const keysToPopulate = (keys as string[]) || Object.keys(shape);

  const populateField = (field: z.ZodTypeAny): z.ZodTypeAny => {
    const meta = getMongooseMeta(field);
    const {schema: unwrapped, features} = unwrapZodSchema(field);

    let result = field;
    if (meta?.refSchema) {
      result = meta.refSchema;
    } else if (unwrapped instanceof z.ZodArray) {
      const populatedInner = populateField((unwrapped as any).element);
      if (populatedInner !== (unwrapped as any).element) {
        result = z.array(populatedInner);
      }
    } else if (unwrapped instanceof z.ZodObject) {
      result = populateZodSchema(unwrapped);
    }

    if (result !== field && result !== unwrapped) {
      // Re-apply common wrappers if they were lost during unwrap
      if (features.isOptional && !(result instanceof z.ZodOptional)) {
        result = (result as any).optional();
      }
      if (features.isNullable && !(result instanceof z.ZodNullable)) {
        result = (result as any).nullable();
      }
      if (features.default !== undefined && !(result instanceof z.ZodDefault)) {
        result = (result as any).default(features.default);
      }
    }

    return result;
  };

  for (const key of keysToPopulate) {
    newShape[key] = populateField(shape[key]);
  }

  return z.object(newShape) as any as z.ZodObject<{
    [P in keyof S['shape']]: P extends (K extends never ? any : K)
      ? UnwrapZRefSchema<S['shape'][P]>
      : S['shape'][P];
  }>;
}

const DateFieldZod = () => z.date().default(() => new Date());

export const genTimestampsSchema = <CrAt = 'createdAt', UpAt = 'updatedAt'>(
  createdAtField: StringLiteral<CrAt | 'createdAt'> | null = 'createdAt' as any,
  updatedAtField: StringLiteral<UpAt | 'updatedAt'> | null = 'updatedAt' as any,
) => {
  if (
    createdAtField != null &&
    updatedAtField != null &&
    (createdAtField as string) === (updatedAtField as string)
  ) {
    throw new Error('`createdAt` and `updatedAt` fields must be different');
  }

  const shape: any = {};
  if (createdAtField != null) {
    shape[createdAtField as string] = withMongoose(DateFieldZod(), {immutable: true, index: true});
  }
  if (updatedAtField != null) {
    shape[updatedAtField as string] = withMongoose(DateFieldZod(), {index: true});
  }

  return shape;
};

/**
 * Utility type to extract the populated object type from a Zod schema field
 * that uses `zRef`.
 * Note: Use this with the Zod schema type, e.g. PopulatedSchema<typeof PostSchema, 'author'>
 * If no keys are provided, it populates all fields.
 */
export type PopulatedSchema<T, K extends string = any> =
  T extends z.ZodObject<infer Shape>
    ? {
        [P in keyof Shape]: P extends K ? UnwrapZRef<Shape[P]> : z.infer<Shape[P]>;
      } & {
        _id?: any;
      }
    : T extends object
      ? {
          [P in keyof T]: P extends K ? UnwrapZRef<T[P]> : T[P];
        }
      : T;

export const bufferMongooseGetter = (value: unknown) =>
  value != null && (value as any)._bsontype === 'Binary' ? (value as any).buffer : value;
