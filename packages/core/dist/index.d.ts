import { z } from 'zod/v4';
import mongoose, { SchemaOptions, QueryFilter, ProjectionType, QueryOptions, Query, UpdateQuery } from 'mongoose';
import * as hookable from 'hookable';

interface ToMongooseSchemaOptions extends SchemaOptions {
    plugins?: Array<(schema: mongoose.Schema, options?: any) => void>;
    validateBeforeSave?: boolean;
}
/**
 * DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including custom application flags.
 * We use a more permissive base to avoid recursive type checking issues with
 * complex Mongoose types in the registry and hooks.
 */
interface MongooseMeta extends Record<string, any> {
    explicitId?: boolean;
    schema?: any;
    ref?: string;
    refSchema?: any;
}
/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
declare const mongooseRegistry: z.core.$ZodRegistry<MongooseMeta, z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
/**
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
declare function withMongoose<T extends z.ZodTypeAny>(schema: T, meta?: MongooseMeta): T;
/**
 * Recursively collect Mongoose metadata from a Zod schema and its wrappers.
 */
declare function getMongooseMeta(schema: z.ZodTypeAny): MongooseMeta;

/**
 * Type-level mapping from Zod to Mongoose Schema Definitions
 */
type ToMongooseType<T extends z.ZodTypeAny> = (T extends z.ZodObject<infer Shape> ? {
    [K in keyof Shape]: Shape[K] extends z.ZodTypeAny ? ToMongooseType<Shape[K]> : any;
} : T extends z.ZodArray<infer Element> ? Element extends z.ZodTypeAny ? Array<ToMongooseType<Element>> | {
    type: Array<any>;
    [key: string]: any;
} : Array<any> : T extends z.ZodOptional<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : T extends z.ZodDefault<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : T extends z.ZodNullable<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : any) & Record<string, any>;
/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
declare function extractMongooseDef<T extends z.ZodTypeAny>(schema: T, visited?: Map<z.ZodTypeAny, any>, isField?: boolean, noWrap?: boolean): ToMongooseType<T>;

/**
 * Converts a Zod schema to a Mongoose Schema instance.
 */
declare function toMongooseSchema<T extends z.ZodTypeAny>(schema: T, options?: ToMongooseSchemaOptions): mongoose.Schema<z.infer<T>>;

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;
type ZRefBrand<S extends z.ZodTypeAny> = {
    readonly _isZRef: true;
    readonly _refSchema: S;
};
type IsomorphicObjectId = string | mongoose.Types.ObjectId;
type ExtractRefSchema<T> = T extends ZRefBrand<infer S> ? S : T extends {
    _refSchema: infer S;
} ? S extends z.ZodTypeAny ? S : T : T extends {
    _isZRef?: true;
    _refSchema?: infer S;
} ? NonNullable<S> extends z.ZodTypeAny ? NonNullable<S> : T : T extends z.ZodTypeAny ? T extends {
    unwrap: () => infer U;
} ? ExtractRefSchema<U> : T extends {
    _def: {
        innerType: infer I;
    };
} ? ExtractRefSchema<I> : T extends {
    _def: {
        schema: infer S;
    };
} ? ExtractRefSchema<S> : T : T;
type HasZRef<T> = T extends ZRefBrand<any> ? true : T extends {
    _refSchema: any;
} ? true : T extends {
    _isZRef?: true;
    _refSchema?: any;
} ? true : T extends z.ZodObject<any> ? true : T extends z.ZodArray<any> ? true : T extends Array<any> ? true : T extends {
    _def: {
        innerType: any;
    };
} ? true : false;
type DeepUnwrapZRef<T> = HasZRef<T> extends false ? T extends z.ZodTypeAny ? z.infer<T> extends mongoose.Types.ObjectId ? IsomorphicObjectId : z.infer<T> : T extends mongoose.Types.ObjectId ? IsomorphicObjectId : T : T extends z.ZodArray<infer E> ? Array<DeepUnwrapZRef<E>> : T extends Array<infer E> ? Array<DeepUnwrapZRef<E>> : T extends z.ZodObject<infer Shape> ? {
    [P in keyof Shape]: DeepUnwrapZRef<Shape[P]>;
} : T extends {
    _def: {
        innerType: infer I;
    };
} ? T extends z.ZodOptional<any> ? DeepUnwrapZRef<I> | undefined : T extends z.ZodNullable<any> ? DeepUnwrapZRef<I> | null : DeepUnwrapZRef<I> : T extends {
    unwrap: () => infer U;
} ? DeepUnwrapZRef<U> : ExtractRefSchema<T> extends z.ZodTypeAny ? z.infer<ExtractRefSchema<T>> extends mongoose.Types.ObjectId ? IsomorphicObjectId : z.infer<ExtractRefSchema<T>> : T;
type UnwrapZRefSchema<T> = T extends z.ZodArray<infer E> ? z.ZodArray<UnwrapZRefSchema<E>> : T extends z.ZodObject<infer Shape> ? z.ZodObject<{
    [P in keyof Shape]: UnwrapZRefSchema<Shape[P]>;
}> : T extends {
    _def: {
        schema: infer S;
    };
} ? UnwrapZRefSchema<S> : ExtractRefSchema<T> extends z.ZodTypeAny ? ExtractRefSchema<T> : T;
declare function populateZodSchema<S extends z.ZodObject<any>, K extends keyof S['shape']>(schema: S, keys?: K[]): z.ZodObject<{ [P in keyof S["shape"]]: P extends (K extends never ? any : K) ? UnwrapZRefSchema<S["shape"][P]> : S["shape"][P]; }>;
declare const genTimestampsSchema: <CrAt = "createdAt", UpAt = "updatedAt">(createdAtField?: StringLiteral<CrAt | "createdAt"> | null, updatedAtField?: StringLiteral<UpAt | "updatedAt"> | null) => any;
type PopulatedSchema<T, K extends string = any> = T extends z.ZodObject<infer Shape> ? {
    [P in keyof Shape]: [K] extends [any] ? DeepUnwrapZRef<Shape[P]> : P extends K ? DeepUnwrapZRef<Shape[P]> : z.infer<Shape[P]>;
} & {
    _id?: any;
} : T extends object ? {
    [P in keyof T]: [K] extends [any] ? DeepUnwrapZRef<T[P]> : P extends K ? DeepUnwrapZRef<T[P]> : T[P];
} : T;
declare const bufferMongooseGetter: (value: unknown) => any;

declare const zObjectId: (options?: MongooseMeta) => z.ZodCodec<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodCustom<mongoose.Types.ObjectId, mongoose.Types.ObjectId>, z.ZodString]>>, z.ZodCustom<mongoose.Types.ObjectId, mongoose.Types.ObjectId>>;
declare const zBuffer: (options?: MongooseMeta) => z.ZodCustom<Buffer<ArrayBufferLike>, Buffer<ArrayBufferLike>>;
declare const zRef: <T extends z.ZodTypeAny>(ref: string, schema: T, options?: MongooseMeta) => z.ZodType<(string | mongoose.Types.ObjectId) & Partial<ZRefBrand<T>>, any> & ZRefBrand<T>;

/**
 * Enable or disable frontend mode.
 * In frontend mode, specialized types like ObjectId and Buffer fall back to
 * simpler representations (strings/arrays) and do not depend on Mongoose.
 */
declare const setFrontendMode: (enabled: boolean) => void;
declare const getFrontendMode: () => boolean;
/**
 * Manually set the Mongoose instance.
 * Useful in ESM environments where automatic detection via require() might fail.
 */
declare const setMongoose: (m: any) => void;
declare const getMongoose: () => any;

interface MongooseZodHooks {
    /**
     * Called before starting the conversion of a Zod schema to a Mongoose definition.
     */
    'converter:before': (context: {
        schema: z.ZodTypeAny;
        visited: Map<z.ZodTypeAny, any>;
    }) => void;
    /**
     * Called at the start of each `extractMongooseDef` call, before any processing.
     */
    'converter:start': (context: {
        schema: z.ZodTypeAny;
        visited: Map<z.ZodTypeAny, any>;
    }) => void;
    /**
     * Called after unwrapping the Zod schema and extracting metadata, but before processing its type.
     */
    'converter:unwrapped': (context: {
        schema: z.ZodTypeAny;
        unwrapped: z.ZodTypeAny;
        features: any;
        meta: MongooseMeta;
        mongooseProp: any;
    }) => void;
    /**
     * Called for each node being processed in the AST walk.
     */
    'converter:node': (context: {
        schema: z.ZodTypeAny;
        mongooseProp: any;
        type: string;
    }) => void;
    /**
     * Called when a ZodObject is about to be processed.
     */
    'schema:object:before': (context: {
        schema: z.ZodObject<any>;
        mongooseProp: any;
        visited: Map<z.ZodTypeAny, any>;
    }) => void;
    /**
     * Called after a ZodObject has been processed.
     */
    'schema:object:after': (context: {
        schema: z.ZodObject<any>;
        mongooseProp: any;
        objDef: any;
        result: any;
    }) => void;
    /**
     * Called during ZodObject conversion for each field.
     */
    'schema:object:field': (context: {
        key: string;
        schema: z.ZodTypeAny;
        objDef: any;
        visited: Map<z.ZodTypeAny, any>;
    }) => void;
    /**
     * Called when a ZodArray/Set/Tuple is about to be processed.
     */
    'schema:array:before': (context: {
        schema: z.ZodArray<any> | z.ZodSet<any> | z.ZodTuple<any>;
        mongooseProp: any;
        visited: Map<z.ZodTypeAny, any>;
    }) => void;
    /**
     * Called after a ZodArray/Set/Tuple has been processed.
     */
    'schema:array:after': (context: {
        schema: z.ZodArray<any> | z.ZodSet<any> | z.ZodTuple<any>;
        mongooseProp: any;
        innerDef: any;
    }) => void;
    /**
     * Called when a ZodRecord/Map is about to be processed.
     */
    'schema:record:before': (context: {
        schema: z.ZodRecord<any, any> | z.ZodMap<any, any>;
        mongooseProp: any;
        visited: Map<z.ZodTypeAny, any>;
    }) => void;
    /**
     * Called after a ZodRecord/Map has been processed.
     */
    'schema:record:after': (context: {
        schema: z.ZodRecord<any, any> | z.ZodMap<any, any>;
        mongooseProp: any;
        innerDef: any;
    }) => void;
    /**
     * Called when a ZodUnion/DiscriminatedUnion is about to be processed.
     */
    'schema:union:before': (context: {
        schema: z.ZodUnion<any> | z.ZodDiscriminatedUnion<any, any>;
        mongooseProp: any;
        ctx: {
            isSimpleUnion: boolean;
            isObjectUnion: boolean;
            isXor: boolean;
        };
    }) => void;
    /**
     * Called after a ZodUnion/DiscriminatedUnion has been processed.
     */
    'schema:union:after': (context: {
        schema: z.ZodUnion<any> | z.ZodDiscriminatedUnion<any, any>;
        mongooseProp: any;
        ctx: {
            isSimpleUnion: boolean;
            isObjectUnion: boolean;
            isXor: boolean;
        };
    }) => void;
    /**
     * Called after the conversion of a Zod schema is complete.
     */
    'converter:after': (context: {
        schema: z.ZodTypeAny;
        mongooseProp: any;
    }) => void;
    /**
     * Called when adding metadata to the registry.
     */
    'registry:add': (context: {
        schema: z.ZodTypeAny;
        meta: MongooseMeta;
    }) => void;
    /**
     * Called after adding metadata to the registry.
     */
    'registry:added': (context: {
        schema: z.ZodTypeAny;
        meta: MongooseMeta;
    }) => void;
    /**
     * Called before getting metadata from the registry.
     */
    'registry:get:before': (context: {
        schema: z.ZodTypeAny;
    }) => void;
    /**
     * Called when getting metadata from the registry.
     */
    'registry:get': (context: {
        schema: z.ZodTypeAny;
        meta: MongooseMeta | undefined;
    }) => void;
    /**
     * Called after mapping Zod checks to Mongoose options.
     */
    'validation:mappers': (context: {
        checks: any[];
        mongooseProp: any;
    }) => void;
    /**
     * Called after a Mongoose Schema instance has been created in `toMongooseSchema`.
     */
    'schema:created': (context: {
        schema: z.ZodTypeAny;
        mongooseSchema: any;
        options?: any;
    }) => void;
}
declare const hooks: hookable.Hookable<MongooseZodHooks, hookable.HookKeys<MongooseZodHooks>>;
/**
 * Synchronous hook caller for Hookable.
 */
declare function callHookSync<Name extends keyof MongooseZodHooks>(name: Name, ...args: Parameters<MongooseZodHooks[Name]>): void;

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
/** Splits a space-separated string literal into a tuple of entries */
type SplitSpaces<S extends string> = string extends S ? string[] : S extends `${infer T} ${infer U}` ? [T, ...SplitSpaces<U>] : [S];
/** * Validates whether a given string path or space-separated path is valid for DocType.
 * If invalid, it forces a strict type error.
 */
type ValidatePath<DocType, P extends string> = string extends P ? string : P extends `${infer Head} ${infer Tail}` ? `${ValidatePath<DocType, Head>} ${ValidatePath<DocType, Tail>}` : P extends `${infer Head}.${infer Tail}` ? Head extends keyof DocType ? `${Head}.${ValidatePath<z.infer<GetTargetSchema<DocType, Head>>, Tail>}` : ExtractPopulatePaths<DocType> : P extends keyof DocType ? P : ExtractPopulatePaths<DocType>;
/** Handles dot-notation paths like 'author.user' and wraps levels uniformly in StrictDocument */
type HydrateDotPath<Base, Path extends string> = Path extends `${infer Head}.${infer Tail}` ? Head extends keyof Base ? Head extends string ? Omit<Base, Head> & {
    [K in Head]: Base[Head] extends Array<any> ? StrictDocument<HydrateDotPath<z.infer<GetTargetSchema<Base, Head>>, Tail>>[] : StrictDocument<HydrateDotPath<z.infer<GetTargetSchema<Base, Head>>, Tail>> | (Base[Head] & (null | undefined));
} : Base : Base : Path extends keyof Base ? Path extends string ? HydratePopulatedPath<Base, Path> : Base : Base;
/** Sequentially runs multiple path hydrations down an array tuple sequence */
type HydrateMultiplePaths<Base, Paths extends string[]> = Paths extends [
    infer Head,
    ...infer Tail
] ? Head extends string ? Tail extends string[] ? HydrateMultiplePaths<HydrateDotPath<Base, Head>, Tail> : HydrateDotPath<Base, Head> : Base : Base;
/** Identifies keys within a shape that are explicitly marked as ZRefs */
type ExtractPopulatePaths<T> = {
    [K in keyof T]: NonNullable<UnwrapArray<T[K]>> extends ZRefBrand<any> | Partial<ZRefBrand<any>> ? K : never;
}[keyof T] & string;
/** Grabs the inner raw Zod schema contained within a branded property block */
type GetTargetSchema<T, K extends keyof T> = NonNullable<UnwrapArray<T[K]>> extends {
    _refSchema?: infer R;
} ? R extends z.ZodTypeAny ? R : never : never;
/** Swaps a target primitive/ID field for its fully inferred Zod counterpart wrapped in StrictDocument */
type HydratePopulatedPath<Base, K extends keyof Base> = Omit<Base, K> & {
    [P in K]: Base[P] extends Array<any> ? StrictDocument<z.infer<GetTargetSchema<Base, P>>>[] : StrictDocument<z.infer<GetTargetSchema<Base, P>>> | (Base[P] & (null | undefined));
};
type PopulateObject<DocType> = {
    [P in ExtractPopulatePaths<DocType>]: {
        path: P;
        populate?: PopulateOptions<z.infer<GetTargetSchema<DocType, P>>>;
    };
}[ExtractPopulatePaths<DocType>];
type PopulateOptions<DocType> = PopulateObject<DocType> | PopulateObject<DocType>[];
/** Evaluates standard inputs, spaces, dots, and objects to output the resulting structure */
type DeterminePopulatedResult<DocType, P> = P extends string ? HydrateMultiplePaths<DocType, SplitSpaces<P>> : P extends {
    path: infer PathKey;
} ? PathKey extends keyof DocType ? PathKey extends string ? P extends {
    populate: any;
} ? Omit<DocType, PathKey> & {
    [K in PathKey]: DocType[K] extends Array<any> ? StrictDocument<DeterminePopulatedResult<z.infer<GetTargetSchema<DocType, PathKey>>, P['populate']>>[] : StrictDocument<DeterminePopulatedResult<z.infer<GetTargetSchema<DocType, PathKey>>, P['populate']>> | (DocType[K] & (null | undefined));
} : HydratePopulatedPath<DocType, PathKey> : DocType : DocType : DocType;
/**
 * An enhanced Mongoose Document type that tracks population state.
 *
 * @template DocType The Zod-inferred document type.
 */
type StrictDocument<DocType> = Omit<mongoose.Document, 'populate'> & DocType & {
    /**
     * Populates document references and returns a document with updated type information.
     *
     * @param path The path(s) to populate. Supports dot notation, spaces, and recursive objects.
     */
    populate<P extends string | PopulateOptions<DocType>>(path: P extends string ? ValidatePath<DocType, P> : P): Promise<StrictDocument<DeterminePopulatedResult<DocType, P>>>;
};
/**
 * An enhanced Mongoose Query type that tracks population state.
 *
 * @template Result The current result type of the query.
 * @template DocType The base document type.
 */
type StrictQuery<Result, DocType, Helpers = {}, RawDoc = {}> = Omit<Query<Result, any, Helpers, RawDoc>, 'populate' | 'exec'> & {
    /**
     * Populates document references and returns a query with updated result type information.
     *
     * @param path The path(s) to populate. Supports dot notation, spaces, and recursive objects.
     */
    populate<P extends string | PopulateOptions<DocType>>(path: P extends string ? ValidatePath<DocType, P> : P): StrictQuery<Result extends Array<any> ? StrictDocument<DeterminePopulatedResult<DocType, P>>[] : StrictDocument<DeterminePopulatedResult<DocType, P>> | (Result & (null | undefined)), DeterminePopulatedResult<DocType, P>, Helpers, RawDoc>;
    /**
     * Executes the query and returns the populated result.
     */
    exec(): Promise<Result>;
};
interface ModelQueryOverrides<DocType> {
    find(filter?: QueryFilter<DocType>, projection?: ProjectionType<DocType> | null, options?: QueryOptions<DocType> | null): StrictQuery<StrictDocument<DocType>[], DocType>;
    findOne(filter?: QueryFilter<DocType>, projection?: ProjectionType<DocType> | null, options?: QueryOptions<DocType> | null): StrictQuery<StrictDocument<DocType> | null, DocType>;
    findById(id: any, projection?: ProjectionType<DocType> | null, options?: QueryOptions<DocType> | null): StrictQuery<StrictDocument<DocType> | null, DocType>;
    findOneAndUpdate(filter?: QueryFilter<DocType>, update?: UpdateQuery<DocType>, options?: QueryOptions<DocType> | null): StrictQuery<StrictDocument<DocType> | null, DocType>;
    findByIdAndUpdate(id: any, update?: UpdateQuery<DocType>, options?: QueryOptions<DocType> | null): StrictQuery<StrictDocument<DocType> | null, DocType>;
}
/**
 * A type-safe wrapper for Mongoose Models that provides fluent population tracking.
 */
type StrictModel<RawModel, DocType> = Omit<RawModel, keyof ModelQueryOverrides<DocType>> & ModelQueryOverrides<DocType>;
/**
 * Converts a standard Mongoose model into a `StrictModel` with advanced type-safe population.
 *
 * @template UserInferredType The Zod-inferred type of the document (e.g. `z.infer<typeof Schema>`).
 * @param name The model name to register or retrieve from Mongoose.
 * @param mongooseSchema The Mongoose schema instance.
 * @returns A `StrictModel` instance with enhanced type safety for population.
 *
 * @example
 * ```typescript
 * const PostModel = toStrictModel<Post>('Post', postSchema);
 * const post = await PostModel.findOne().populate('author').exec();
 * // post.author is now fully typed
 * ```
 */
declare function toStrictModel<UserInferredType>(name: string, mongooseSchema: mongoose.Schema): StrictModel<any, UserInferredType>;

export { bufferMongooseGetter, callHookSync, extractMongooseDef, genTimestampsSchema, getFrontendMode, getMongoose, getMongooseMeta, hooks, mongooseRegistry, populateZodSchema, setFrontendMode, setMongoose, toMongooseSchema, toStrictModel, withMongoose, zBuffer, zObjectId, zRef };
export type { ExtractPopulatePaths, GetTargetSchema, HydrateMultiplePaths, HydratePopulatedPath, MongooseMeta, MongooseZodHooks, PopulateObject, PopulateOptions, PopulatedSchema, StrictDocument, StrictModel, StrictQuery, ToMongooseSchemaOptions, ToMongooseType, ZRefBrand };
