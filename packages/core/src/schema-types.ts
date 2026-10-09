import type mongoose from 'mongoose';
import type {z} from 'zod/v4';

/** Type-only metadata carried by withMongoose(); registry values remain runtime data. */
declare const schemaMetadata: unique symbol;
export interface WithSchemaMetadata<Options> {
  readonly [schemaMetadata]: () => Options;
}
export type SchemaMetadata<T> = T extends WithSchemaMetadata<infer Options> ? Options : {};
export type MergeOptions<Base, Override> = Omit<Base, keyof Override> & Override;
export type SchemaTypeOptions = Pick<
  mongoose.SchemaOptions,
  'timestamps' | '_id' | 'id' | 'versionKey'
>;

type TimestampKey<Options, Key extends string> = Key extends keyof Options
  ? Options[Key] extends false
    ? never
    : Options[Key] extends string
      ? Options[Key]
      : Key
  : Key;
type TimestampFields<Options> = Options extends {timestamps: infer Timestamps}
  ? Timestamps extends true
    ? {createdAt: Date; updatedAt: Date}
    : Timestamps extends object
      ? {
          [K in
            | TimestampKey<Timestamps, 'createdAt'>
            | TimestampKey<Timestamps, 'updatedAt'>]: Date;
        }
      : {}
  : {};
export type SchemaDocument<T, Options> = keyof (TimestampFields<Options> &
  VersionField<Options>) extends never
  ? T
  : T extends unknown
    ? T & Omit<TimestampFields<Options> & VersionField<Options>, keyof T>
    : never;

type RemovedDocumentKeys<Raw, Options> =
  | (Options extends {_id: false} ? ('_id' extends keyof Raw ? never : '_id') : never)
  | ('id' extends keyof Raw
      ? never
      : Options extends {id: false}
        ? 'id'
        : Options extends {_id: false}
          ? '_id' extends keyof Raw
            ? never
            : 'id'
          : never)
  | (Options extends {versionKey: false | string}
      ? '__v' extends keyof Raw
        ? never
        : '__v'
      : never);
type VersionField<Options> = Options extends {versionKey: infer Key extends string}
  ? string extends Key
    ? {}
    : {[K in Key]: number}
  : {};
type RemoveKeys<Value, Keys> = {[K in keyof Value as K extends Keys ? never : K]: Value[K]};
type RemoveGeneratedFields<Value, Raw, Options> =
  RemovedDocumentKeys<Raw, Options> extends never
    ? Value
    : RemoveKeys<Value, RemovedDocumentKeys<Raw, Options>>;

type SchemaSerializer<Raw, Options, Virtuals> = {
  (): RemoveGeneratedFields<
    mongoose.Default__v<mongoose.Require_id<SchemaDocument<Raw, Options>>, Options>,
    Raw,
    Options
  >;
  <const OutputOptions extends mongoose.ToObjectOptions = {}>(
    options?: OutputOptions,
  ): RemoveGeneratedFields<
    mongoose.ToObjectReturnType<
      SchemaDocument<Raw, Options>,
      mongoose.AddDefaultId<Raw, Virtuals, Options>,
      OutputOptions,
      Options
    >,
    Raw,
    Options
  >;
  <Override>(
    options?: mongoose.ToObjectOptions,
  ): RemoveGeneratedFields<
    mongoose.Default__v<mongoose.Require_id<Override>, Options>,
    Override,
    Options
  >;
};
export type SchemaHydratedDocument<Hydrated, Raw, Options, Virtuals = {}> = Hydrated extends unknown
  ? Extract<keyof Options, keyof SchemaTypeOptions> extends never
    ? Hydrated
    : RemoveKeys<RemoveGeneratedFields<Hydrated, Raw, Options>, 'toObject' | 'toJSON'> &
        Omit<TimestampFields<Options>, keyof Raw> &
        VersionField<Options> & {
          toObject: SchemaSerializer<Raw, Options, Virtuals>;
          toJSON: SchemaSerializer<Raw, Options, Virtuals>;
        }
  : never;
export type ConvertedDocument<T extends z.ZodTypeAny, Options> = SchemaDocument<
  z.infer<T>,
  Options
>;
