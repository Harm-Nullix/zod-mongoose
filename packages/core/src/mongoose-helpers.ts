import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import {withMongoose, MongooseMeta, getMongooseMeta} from './registry.js';
import {getFrontendMode, getMongoose} from './config.js';
import {unwrapZodSchema} from './zod-helpers.js';

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

// ============================================================================
// 1. LIGHTWEIGHT BRANDING & HIGH-PERFORMANCE DUAL-MODE ENGINES
// ============================================================================

export type ZRefBrand<S extends z.ZodTypeAny> = {
  readonly _isZRef: true;
  readonly _refSchema: S;
};

/**
 * Extracts the targeted Zod Schema from either a Zod Class definition
 * OR a raw TypeScript primitive type intersection (Partial<ZRefBrand>).
 */
type ExtractRefSchema<T> =
  T extends ZRefBrand<infer S>
    ? S
    : T extends {_refSchema: infer S}
      ? S extends z.ZodTypeAny
        ? S
        : T
      : T extends {_isZRef?: true; _refSchema?: infer S}
        ? NonNullable<S> extends z.ZodTypeAny
          ? NonNullable<S>
          : T
        : T extends z.ZodTypeAny
          ? T extends {unwrap: () => infer U}
            ? ExtractRefSchema<U>
            : T extends {_def: {innerType: infer I}}
              ? ExtractRefSchema<I>
              : T
          : T;

/**
 * Fast look-ahead check. Sweeps the field to see if a ZRef brand exists
 * anywhere in the type hierarchy so the compiler can short-circuit non-relational fields.
 */
type HasZRef<T> =
  T extends ZRefBrand<any>
    ? true
    : T extends {_refSchema: any}
      ? true
      : T extends {_isZRef?: true; _refSchema?: any}
        ? true
        : T extends z.ZodObject<any>
          ? true
          : T extends z.ZodArray<any>
            ? true
            : T extends Array<any>
              ? true
              : T extends {_def: {innerType: any}}
                ? true
                : false;

/**
 * Deeply traverses schemas and inferred primitives to unpack zRefs, maintaining
 * structural layouts (arrays, objects, optionals) along the way.
 */
type DeepUnwrapZRef<T> =
  HasZRef<T> extends false
    ? T extends z.ZodTypeAny
      ? z.infer<T>
      : T
    : T extends z.ZodArray<infer E>
      ? Array<DeepUnwrapZRef<E>>
      : T extends Array<infer E>
        ? Array<DeepUnwrapZRef<E>> // Recursively processes raw inferred array elements
        : T extends z.ZodObject<infer Shape>
          ? {[P in keyof Shape]: DeepUnwrapZRef<Shape[P]>}
          : T extends {_def: {innerType: infer I}}
            ? T extends z.ZodOptional<any>
              ? DeepUnwrapZRef<I> | undefined
              : T extends z.ZodNullable<any>
                ? DeepUnwrapZRef<I> | null
                : DeepUnwrapZRef<I>
            : T extends {unwrap: () => infer U}
              ? DeepUnwrapZRef<U>
              : ExtractRefSchema<T> extends z.ZodTypeAny
                ? z.infer<ExtractRefSchema<T>>
                : T;

type UnwrapZRefSchema<T> =
  T extends z.ZodArray<infer E>
    ? z.ZodArray<UnwrapZRefSchema<E>>
    : T extends z.ZodObject<infer Shape>
      ? z.ZodObject<{[P in keyof Shape]: UnwrapZRefSchema<Shape[P]>}>
      : ExtractRefSchema<T> extends z.ZodTypeAny
        ? ExtractRefSchema<T>
        : T;

// ============================================================================
// 2. PRIMITIVE TYPES (ObjectId & Buffer)
// ============================================================================

const preprocessFn = (val: unknown) => (val === null ? undefined : val);
export const zObjectId = (options?: MongooseMeta) => {
  const isFrontend = getFrontendMode();

  if (isFrontend) {
    return withMongoose(
      z.preprocess(preprocessFn, z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')),
      {type: 'ObjectId', ...options},
    );
  }

  const mongooseInstance = getMongoose();
  return withMongoose(
    z.preprocess(
      preprocessFn,
      z.custom<mongoose.Types.ObjectId>(
        (val) =>
          (mongooseInstance && val instanceof mongooseInstance.Types.ObjectId) ||
          (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)),
      ),
    ),
    {type: mongooseInstance?.Schema.Types.ObjectId || 'ObjectId', ...options},
  );
};

export const zBuffer = (options?: MongooseMeta) => {
  if (getFrontendMode()) {
    return withMongoose(z.instanceof(Uint8Array), {type: 'Buffer', ...options});
  }

  const mongooseInstance = getMongoose();
  return withMongoose(
    z.custom<Buffer>(
      (val) => (mongooseInstance && val instanceof Buffer) || val instanceof Uint8Array,
    ),
    {type: mongooseInstance?.Schema.Types.Buffer || 'Buffer', ...options},
  );
};

// ============================================================================
// 3. REF SCHEMAS & DYNAMIC POPULATION
// ============================================================================

export const zRef = <T extends z.ZodTypeAny>(ref: string, schema: T, options?: MongooseMeta) => {
  const isFrontend = getFrontendMode();
  const mongooseInstance = getMongoose();
  const objectIdSchema = zObjectId();

  const base = z.codec(z.union([objectIdSchema, schema]), objectIdSchema as any, {
    decode: (val: any) => (typeof val === 'object' && val !== null && '_id' in val ? val._id : val),
    encode: (val: any) => val,
  });

  const result = withMongoose(base as any, {
    type: isFrontend ? 'ObjectId' : mongooseInstance?.Schema.Types.ObjectId || 'ObjectId',
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
      if (populatedInner !== unwrapped.element) {
        result = z.array(populatedInner);
      }
    } else if (unwrapped instanceof z.ZodObject) {
      result = populateZodSchema(unwrapped);
    }

    if (result !== field && result !== unwrapped) {
      if (features.isOptional && !(result instanceof z.ZodOptional)) result = result.optional();
      if (features.isNullable && !(result instanceof z.ZodNullable)) result = result.nullable();
      if (features.default !== undefined && !(result instanceof z.ZodDefault)) result = result.default(features.default);
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

// ============================================================================
// 4. TIMESTAMPS & OUTPUT FORMATTING
// ============================================================================

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
  if (createdAtField != null) shape[createdAtField as string] = withMongoose(DateFieldZod(), {immutable: true, index: true});
  if (updatedAtField != null) shape[updatedAtField as string] = withMongoose(DateFieldZod(), {index: true});

  return shape;
};

export type PopulatedSchema<T, K extends string = any> =
  T extends z.ZodObject<infer Shape>
    ? {
        [P in keyof Shape]: [K] extends [any]
          ? DeepUnwrapZRef<Shape[P]>
          : P extends K
            ? DeepUnwrapZRef<Shape[P]>
            : z.infer<Shape[P]>;
      } & {_id?: any}
    : T extends object
      ? {
          [P in keyof T]: [K] extends [any]
            ? DeepUnwrapZRef<T[P]>
            : P extends K
              ? DeepUnwrapZRef<T[P]>
              : T[P];
        }
      : T;

export const bufferMongooseGetter = (value: unknown) =>
  value != null && (value as any)._bsontype === 'Binary' ? (value as any).buffer : value;
