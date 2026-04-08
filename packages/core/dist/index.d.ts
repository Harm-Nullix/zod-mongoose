import { z } from 'zod/v4';
import mongoose, { SchemaOptions } from 'mongoose';
import * as hookable from 'hookable';

/**
 * DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including custom application flags.
 * We use a more permissive base to avoid recursive type checking issues with
 * complex Mongoose types in the registry and hooks.
 */
interface MongooseMeta extends Record<string, any> {
    explicitId?: boolean;
}
/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
declare const mongooseRegistry: z.core.$ZodRegistry<MongooseMeta, z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
/**
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
declare function withMongoose<T extends z.ZodTypeAny>(schema: T, meta: MongooseMeta): T;

/**
 * Type-level mapping from Zod to Mongoose Schema Definitions
 */
type ToMongooseType<T extends z.ZodTypeAny> = T extends z.ZodObject<infer Shape> ? {
    [K in keyof Shape]: Shape[K] extends z.ZodTypeAny ? ToMongooseType<Shape[K]> : any;
} : T extends z.ZodArray<infer Element> ? Element extends z.ZodTypeAny ? Array<ToMongooseType<Element>> | {
    type: Array<any>;
    [key: string]: any;
} : Array<any> : T extends z.ZodOptional<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : T extends z.ZodDefault<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : T extends z.ZodNullable<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : any;
/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
declare function extractMongooseDef<T extends z.ZodTypeAny>(schema: T, visited?: Map<z.ZodTypeAny, any>, isField?: boolean): ToMongooseType<T> & Record<string, any>;

interface ToMongooseSchemaOptions extends SchemaOptions {
    plugins?: Array<(schema: mongoose.Schema, options?: any) => void>;
}
/**
 * Converts a Zod schema to a Mongoose Schema instance.
 */
declare function toMongooseSchema<T extends z.ZodTypeAny>(schema: T, options?: ToMongooseSchemaOptions): mongoose.Schema<z.infer<T>>;

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;
declare const zObjectId: (options?: MongooseMeta) => z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodString> | z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodCustom<mongoose.Types.ObjectId, mongoose.Types.ObjectId>>;
declare const zBuffer: (options?: MongooseMeta) => z.ZodCustom<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>> | z.ZodCustom<Buffer<ArrayBufferLike>, Buffer<ArrayBufferLike>>;
declare const zPopulated: <T extends z.ZodTypeAny>(ref: string, schema: T, options?: MongooseMeta) => z.ZodUnion<readonly [z.ZodString | z.ZodCustom<mongoose.Types.ObjectId, mongoose.Types.ObjectId>, T]>;
declare const genTimestampsSchema: <CrAt = "createdAt", UpAt = "updatedAt">(createdAtField?: StringLiteral<CrAt | "createdAt"> | null, updatedAtField?: StringLiteral<UpAt | "updatedAt"> | null) => any;
/**
 * Utility type to extract the populated object type from a Zod schema field
 * that uses `zPopulated`. It excludes string and ObjectId from the union,
 * assuming the field is already populated.
 */
type PopulatedSchema<T, K extends keyof T> = Omit<T, K> & {
    [P in K]: T[P] extends Array<infer U> ? Array<Exclude<U, string | mongoose.Types.ObjectId>> : Exclude<T[P], string | mongoose.Types.ObjectId>;
} & {
    _id?: any;
};
declare const bufferMongooseGetter: (value: unknown) => any;

/**
 * Manually set the Mongoose instance.
 * Useful in ESM environments where automatic detection via require() might fail.
 */
declare const setMongoose: (m: any) => void;
declare const getMongoose: () => any;
/**
 * Enable or disable frontend mode.
 * In frontend mode, specialized types like ObjectId and Buffer fall back to
 * simpler representations (strings/arrays) and do not depend on Mongoose.
 */
declare const setFrontendMode: (enabled: boolean) => void;
declare const getFrontendMode: () => boolean;

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

export { bufferMongooseGetter, callHookSync, extractMongooseDef, genTimestampsSchema, getFrontendMode, getMongoose, hooks, mongooseRegistry, setFrontendMode, setMongoose, toMongooseSchema, withMongoose, zBuffer, zObjectId, zPopulated };
export type { MongooseMeta, MongooseZodHooks, PopulatedSchema, ToMongooseSchemaOptions, ToMongooseType };
