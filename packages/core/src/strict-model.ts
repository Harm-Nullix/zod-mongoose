import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import type {QueryFilter, ProjectionType, QueryOptions, UpdateQuery} from 'mongoose';
import {getMongoose} from './config.js';

// ============================================================================
// 1. STRING PARSING & VALIDATION ENGINE
// ============================================================================

type UnwrapArray<T> = T extends Array<infer U> ? U : T;

/** Splits a space-separated string literal into a tuple of entries */
type SplitSpaces<S extends string> = string extends S
  ? string[]
  : S extends `${infer T} ${infer U}`
    ? [T, ...SplitSpaces<U>]
    : [S];

/** * Validates whether a given string path or space-separated path is valid for DocType.
 * If invalid, it forces a strict type error.
 */
type ValidatePath<DocType, P extends string> = string extends P
  ? string
  : P extends `${infer Head} ${infer Tail}`
    ? `${ValidatePath<DocType, Head>} ${ValidatePath<DocType, Tail>}`
    : P extends `${infer Head}.${infer Tail}`
      ? Head extends ExtractPopulatePaths<DocType>
        ? `${Head}.${ValidatePath<z.infer<GetTargetSchema<DocType, Head>>, Tail>}`
        : ExtractPopulatePaths<DocType>
      : P extends ExtractPopulatePaths<DocType>
        ? P
        : ExtractPopulatePaths<DocType>;

/** Handles dot-notation paths like 'author.user' and wraps levels uniformly in StrictDocument */
type HydrateDotPath<
  Base,
  Path extends string,
  Lean extends boolean = false,
> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof Base
    ? Head extends string
      ? Omit<Base, Head> & {
          [K in Head]: Base[Head] extends Array<any>
            ? ReferenceResult<
                HydrateDotPath<z.infer<GetTargetSchema<Base, Head>>, Tail, Lean>,
                Lean,
                z.infer<GetTargetSchema<Base, Head>>
              >[]
            :
                | ReferenceResult<
                    HydrateDotPath<z.infer<GetTargetSchema<Base, Head>>, Tail, Lean>,
                    Lean,
                    z.infer<GetTargetSchema<Base, Head>>
                  >
                | (Base[Head] & (null | undefined));
        }
      : Base
    : Base
  : Path extends keyof Base
    ? Path extends string
      ? HydratePopulatedPath<Base, Path, Lean>
      : Base
    : Base;

/** Sequentially runs multiple path hydrations down an array tuple sequence */
export type HydrateMultiplePaths<
  Base,
  Paths extends string[],
  Lean extends boolean = false,
> = Paths extends [infer Head, ...infer Tail]
  ? Head extends string
    ? Tail extends string[]
      ? HydrateMultiplePaths<HydrateDotPath<Base, Head, Lean>, Tail, Lean>
      : HydrateDotPath<Base, Head, Lean>
    : Base
  : Base;

// ============================================================================
// 2. CORE SCHEMA EXTRACTORS
// ============================================================================

/** Identifies keys within a shape that are explicitly marked as ZRefs */
export type ExtractPopulatePaths<T> = {
  [K in keyof T]-?: 0 extends 1 & T[K]
    ? never
    : '_refSchema' extends keyof NonNullable<UnwrapArray<T[K]>>
      ? [GetTargetSchema<T, K>] extends [never]
        ? never
        : K
      : never;
}[keyof T] &
  string;

/** Grabs the inner raw Zod schema contained within a branded property block */
export type GetTargetSchema<T, K extends keyof T> =
  NonNullable<UnwrapArray<T[K]>> extends {_refSchema?: infer R}
    ? R extends z.ZodTypeAny
      ? R
      : never
    : never;

type ReferenceResult<Doc, Lean extends boolean, Original = Doc> = Lean extends true
  ? mongoose.Default__v<mongoose.Require_id<Doc>>
  : StrictDocument<Original, mongoose.HydratedDocument<Doc>>;

/** Swaps a target primitive/ID field for its fully inferred Zod counterpart wrapped in StrictDocument */
export type HydratePopulatedPath<Base, K extends keyof Base, Lean extends boolean = false> = Omit<
  Base,
  K
> & {
  [P in K]: Base[P] extends Array<any>
    ? ReferenceResult<z.infer<GetTargetSchema<Base, P>>, Lean>[]
    : ReferenceResult<z.infer<GetTargetSchema<Base, P>>, Lean> | (Base[P] & (null | undefined));
};

// ============================================================================
// 3. RECURSIVE DEEP POPULATION LAYOUT (Objects & Options)
// ============================================================================

export type PopulateObject<DocType> = {
  [P in ExtractPopulatePaths<DocType>]: {
    path: P;
    populate?: PopulateOptions<z.infer<GetTargetSchema<DocType, P>>>;
  };
}[ExtractPopulatePaths<DocType>];

export type PopulateOptions<DocType> = PopulateObject<DocType> | readonly PopulateObject<DocType>[];

type PopulatedOptionValue<DocType, P, Key, Lean extends boolean> = P extends unknown
  ? Key extends PopulateRootPaths<P>
    ? DeterminePopulatedResult<DocType, P, Lean> extends infer Populated
      ? Key extends keyof Populated
        ? Populated[Key]
        : never
      : never
    : never
  : never;

/** Apply tuples in order, resolving each entry against the original reference metadata. */
type PopulateOptionsArray<
  DocType,
  Options extends readonly unknown[],
  Result = DocType,
  Lean extends boolean = false,
> = Options extends readonly [infer Head, ...infer Tail]
  ? PopulateOptionsArray<
      DocType,
      Tail,
      PopulatedHydratedDocument<DocType, Head, Result, Lean>,
      Lean
    >
  : number extends Options['length']
    ? {
        // A dynamic array can be empty or contain only some of its possible paths.
        [K in keyof Result]: K extends PopulateRootPaths<Options[number]>
          ? Result[K] | PopulatedOptionValue<DocType, Options[number], K, Lean>
          : Result[K];
      }
    : Result;

/** Mongoose queries combine nested options for repeated paths; documents replace them. */
type OptionsTuple<P> = P extends readonly unknown[]
  ? P
  : P extends string
    ? StringOptions<SplitSpaces<P>>
    : [P];
type StringOptions<Paths extends string[]> = Paths extends [
  infer Head,
  ...infer Tail extends string[],
]
  ? [{path: Head}, ...StringOptions<Tail>]
  : [];
type MergePopulateEntry<Previous, Next> = Previous extends {populate: infer A}
  ? Next extends {populate: infer B}
    ? Omit<Next, 'populate'> & {populate: [...OptionsTuple<A>, ...OptionsTuple<B>]}
    : Next
  : Next;
type AddQueryOption<Options extends readonly unknown[], Next> = Options extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends {path: infer Path}
    ? Next extends {path: Path}
      ? [MergePopulateEntry<Head, Next>, ...Tail]
      : [Head, ...AddQueryOption<Tail, Next>]
    : [Head, ...AddQueryOption<Tail, Next>]
  : [Next];
type QueryOptionsArray<
  Options extends readonly unknown[],
  Result extends readonly unknown[] = [],
> = Options extends readonly [infer Head, ...infer Tail]
  ? QueryOptionsArray<Tail, AddQueryOption<Result, Head>>
  : number extends Options['length']
    ? [...Result, ...Options]
    : Result;
type QueryPopulation<Previous extends readonly unknown[], P> = QueryOptionsArray<
  [...Previous, ...OptionsTuple<P>]
>;

/** Evaluates paths, individual options, and arrays of options. */
type DeterminePopulatedResult<
  DocType,
  P,
  Lean extends boolean = false,
> = P extends readonly unknown[]
  ? PopulateOptionsArray<DocType, P, DocType, Lean>
  : P extends string
    ? HydrateMultiplePaths<DocType, SplitSpaces<P>, Lean>
    : P extends {path: infer PathKey}
      ? PathKey extends keyof DocType
        ? PathKey extends string
          ? P extends {populate: any}
            ? Omit<DocType, PathKey> & {
                [K in PathKey]: DocType[K] extends Array<any>
                  ? ReferenceResult<
                      DeterminePopulatedResult<
                        z.infer<GetTargetSchema<DocType, PathKey>>,
                        QueryOptionsArray<OptionsTuple<P['populate']>>,
                        Lean
                      >,
                      Lean,
                      z.infer<GetTargetSchema<DocType, PathKey>>
                    >[]
                  :
                      | ReferenceResult<
                          DeterminePopulatedResult<
                            z.infer<GetTargetSchema<DocType, PathKey>>,
                            QueryOptionsArray<OptionsTuple<P['populate']>>,
                            Lean
                          >,
                          Lean,
                          z.infer<GetTargetSchema<DocType, PathKey>>
                        >
                      | (DocType[K] & (null | undefined));
              }
            : HydratePopulatedPath<DocType, PathKey, Lean>
          : DocType
        : PathKey extends string
          ? HydrateDotPath<DocType, PathKey, Lean>
          : DocType
      : DocType;

// ============================================================================
// 4. MAIN INTERACTION INTERFACES
// ============================================================================

type PopulateRootPaths<P> = P extends readonly unknown[]
  ? PopulateRootPaths<P[number]>
  : P extends string
    ? P extends `${infer Head} ${infer Tail}`
      ? PopulateRootPaths<Head> | PopulateRootPaths<Tail>
      : P extends `${infer Head}.${string}`
        ? Head
        : P
    : P extends {path: infer Path extends string}
      ? PopulateRootPaths<Path>
      : never;

type PickPopulatedPaths<Result, Paths> = {
  [K in keyof Result as K extends Paths ? K : never]: Result[K];
};

type PopulatedHydratedDocument<DocType, P, Hydrated, Lean extends boolean = false> = Omit<
  Hydrated,
  PopulateRootPaths<P>
> &
  PickPopulatedPaths<DeterminePopulatedResult<DocType, P, Lean>, PopulateRootPaths<P>>;

/**
 * An enhanced Mongoose Document type that tracks population state.
 *
 * @template DocType The Zod-inferred document type.
 */
export type StrictDocument<DocType, Hydrated = mongoose.HydratedDocument<DocType>> = {
  [K in keyof Hydrated as K extends 'populate' ? never : K]: K extends keyof DocType
    ? Hydrated[K]
    : OmitThisParameter<Hydrated[K]>;
} & {
  /**
   * Populates document references and returns a document with updated type information.
   *
   * @param path The path(s) to populate. Supports dot notation, spaces, and recursive objects.
   */
  populate<const P extends string | PopulateOptions<DocType>>(
    path: P & (P extends string ? ValidatePath<DocType, P> : unknown),
  ): Promise<StrictDocument<DocType, PopulatedHydratedDocument<DocType, P, Hydrated>>>;
};

// Bind helpers that return their generic `this` to the current strict query state.
// Helpers with explicit result types (including projections and terminal results)
// retain their declared signatures.
type StrictQueryHelpers<
  Result,
  DocType,
  Helpers,
  RawDoc,
  Hydrated,
  Population extends readonly unknown[],
  Lean extends boolean,
> = {
  [K in keyof Helpers]: ThisParameterType<Helpers[K]> extends mongoose.Query<any, any, any, any>
    ? Helpers[K] extends <T extends ThisParameterType<Helpers[K]>>(
        this: T,
        ...args: infer Args
      ) => T
      ? (...args: Args) => StrictQuery<Result, DocType, Helpers, RawDoc, Hydrated, Population, Lean>
      : Helpers[K]
    : Helpers[K];
};

type NativeFluentKey =
  | 'all'
  | 'allowDiskUse'
  | 'and'
  | 'batchSize'
  | 'box'
  | 'circle'
  | 'clone'
  | 'collation'
  | 'comment'
  | 'elemMatch'
  | 'error'
  | 'equals'
  | 'exists'
  | 'geometry'
  | 'gt'
  | 'gte'
  | 'hint'
  | 'in'
  | 'intersects'
  | 'j'
  | 'limit'
  | 'lt'
  | 'lte'
  | 'maxDistance'
  | 'maxTimeMS'
  | 'merge'
  | 'mod'
  | 'ne'
  | 'near'
  | 'nin'
  | 'nor'
  | 'or'
  | 'polygon'
  | 'pre'
  | 'post'
  | 'read'
  | 'readConcern'
  | 'regex'
  | 'sanitizeProjection'
  | 'schemaLevelProjections'
  | 'session'
  | 'set'
  | 'setOptions'
  | 'size'
  | 'skip'
  | 'slice'
  | 'sort'
  | 'tailable'
  | 'w'
  | 'where'
  | 'within'
  | 'wtimeout';

// Preserve the argument overloads of native methods returning `this`.
// Result-changing/generic methods retain their native signatures or get explicit overrides.
type RebindFluent<F, Strict> = F extends {
  (...args: infer A): infer R;
  (...args: infer B): infer S;
  (...args: infer C): infer T;
  (...args: infer D): infer U;
}
  ? ((...args: A) => R extends {exec(): Promise<unknown>} ? Strict : R) &
      ((...args: B) => S extends {exec(): Promise<unknown>} ? Strict : S) &
      ((...args: C) => T extends {exec(): Promise<unknown>} ? Strict : T) &
      ((...args: D) => U extends {exec(): Promise<unknown>} ? Strict : U)
  : F;
type QueryDocument<DocType, Population, Hydrated, Lean extends boolean> = Lean extends true
  ? PopulatedHydratedDocument<
      DocType,
      Population,
      Pick<Hydrated, Extract<keyof Hydrated, keyof DocType | '_id' | '__v'>>,
      true
    >
  : StrictDocument<DocType, PopulatedHydratedDocument<DocType, Population, Hydrated>>;
type QueryResult<Result, Doc> = Result extends any[] ? Doc[] : Doc | (Result & (null | undefined));
type NativeQuery<Result, Helpers, RawDoc, Hydrated> = mongoose.QueryWithHelpers<
  Result,
  Hydrated,
  Helpers,
  RawDoc
>;

/**
 * An enhanced Mongoose Query type that tracks population state.
 *
 * @template Result The current result type of the query.
 * @template DocType The base document type.
 */
export type StrictQuery<
  Result,
  DocType,
  Helpers = {},
  RawDoc = DocType,
  Hydrated = mongoose.HydratedDocument<DocType>,
  Population extends readonly unknown[] = [],
  Lean extends boolean = false,
> = {
  [K in Exclude<
    keyof NativeQuery<Result, Helpers, RawDoc, Hydrated>,
    'populate' | 'exec' | 'orFail' | 'select' | 'transform' | 'lean'
  >]: K extends keyof Helpers
    ? StrictQueryHelpers<Result, DocType, Helpers, RawDoc, Hydrated, Population, Lean>[K]
    : K extends 'find' | 'findOne' | 'findById'
      ? RebindFluent<
          NativeQuery<Result, Helpers, RawDoc, Hydrated>[K],
          StrictQuery<
            K extends 'find'
              ? QueryDocument<DocType, Population, Hydrated, Lean>[]
              : QueryDocument<DocType, Population, Hydrated, Lean> | null,
            DocType,
            Helpers,
            RawDoc,
            Hydrated,
            Population,
            Lean
          >
        >
      : K extends NativeFluentKey
        ? RebindFluent<
            NativeQuery<Result, Helpers, RawDoc, Hydrated>[K],
            StrictQuery<Result, DocType, Helpers, RawDoc, Hydrated, Population, Lean>
          >
        : NativeQuery<Result, Helpers, RawDoc, Hydrated>[K];
} & {
  /**
   * Populates document references and returns a query with updated result type information.
   *
   * @param path The path(s) to populate. Supports dot notation, spaces, and recursive objects.
   */
  populate<const P extends string | PopulateOptions<DocType>>(
    path: P & (P extends string ? ValidatePath<DocType, P> : unknown),
  ): StrictQuery<
    QueryResult<Result, QueryDocument<DocType, QueryPopulation<Population, P>, Hydrated, Lean>>,
    DocType,
    Helpers,
    RawDoc,
    Hydrated,
    QueryPopulation<Population, P>,
    Lean
  >;

  lean(): StrictQuery<
    QueryResult<Result, QueryDocument<DocType, Population, Hydrated, true>>,
    DocType,
    Helpers,
    RawDoc,
    Hydrated,
    Population,
    true
  >;
  lean(
    value: true | mongoose.LeanOptions,
  ): StrictQuery<
    QueryResult<Result, QueryDocument<DocType, Population, Hydrated, true>>,
    DocType,
    Helpers,
    RawDoc,
    Hydrated,
    Population,
    true
  >;
  lean(
    value: false,
  ): StrictQuery<
    QueryResult<Result, QueryDocument<DocType, Population, Hydrated, false>>,
    DocType,
    Helpers,
    RawDoc,
    Hydrated,
    Population,
    false
  >;
  lean(
    value: boolean,
  ): StrictQuery<
    QueryResult<Result, QueryDocument<DocType, Population, Hydrated, boolean>>,
    DocType,
    Helpers,
    RawDoc,
    Hydrated,
    Population,
    boolean
  >;
  lean<Override>(
    value?: boolean | mongoose.LeanOptions,
  ): mongoose.QueryWithHelpers<Override | (Result & (null | undefined)), Hydrated, Helpers, RawDoc>;
  transform<Mapped>(
    fn: (doc: Result) => Mapped,
  ): mongoose.QueryWithHelpers<Mapped, Hydrated, Helpers, RawDoc>;
  orFail(
    err?: Error | (() => Error),
  ): StrictQuery<NonNullable<Result>, DocType, Helpers, RawDoc, Hydrated, Population, Lean>;
  select<Override extends {[K in keyof RawDoc]?: any} = {}>(
    arg: string | readonly string[] | Record<string, number | boolean | string | object>,
  ): keyof Override extends never
    ? StrictQuery<Result, DocType, Helpers, RawDoc, Hydrated, Population, Lean>
    : mongoose.QueryWithHelpers<
        QueryResult<Result, Lean extends true ? Override : mongoose.HydratedDocument<Override>>,
        Hydrated,
        Helpers,
        Override
      >;

  /**
   * Executes the query and returns the populated result.
   */
  exec(): Promise<Result>;
};

// ============================================================================
// 5. EXPLICIT ENTRY POINT QUERY OVERRIDES
// ============================================================================

interface ModelQueryOverrides<DocType, Helpers, Hydrated> {
  find(
    filter?: QueryFilter<DocType>,
    projection?: ProjectionType<DocType> | null,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType, Hydrated>[], DocType, Helpers, DocType, Hydrated>;

  findOne(
    filter?: QueryFilter<DocType>,
    projection?: ProjectionType<DocType> | null,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType, Hydrated> | null, DocType, Helpers, DocType, Hydrated>;

  findById(
    id: any,
    projection?: ProjectionType<DocType> | null,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType, Hydrated> | null, DocType, Helpers, DocType, Hydrated>;

  findOneAndUpdate(
    filter?: QueryFilter<DocType>,
    update?: UpdateQuery<DocType>,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType, Hydrated> | null, DocType, Helpers, DocType, Hydrated>;

  findByIdAndUpdate(
    id: any,
    update?: UpdateQuery<DocType>,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType, Hydrated> | null, DocType, Helpers, DocType, Hydrated>;
}

type ModelHelpers<RawModel> =
  RawModel extends mongoose.Model<any, infer Helpers, any, any, any, any, any> ? Helpers : {};

type ModelDocument<RawModel, DocType> = RawModel extends {
  hydrate: (...args: any[]) => infer Hydrated;
}
  ? Hydrated
  : mongoose.HydratedDocument<DocType>;

// Mapped types such as Omit discard construct signatures, so preserve it explicitly.
type ModelConstructor<RawModel, DocType> = RawModel extends new (
  ...args: infer Args
) => infer Hydrated
  ? new (...args: Args) => StrictDocument<DocType, Hydrated>
  : unknown;

// Reuse native creation overloads, including aggregate errors and lean/raw insert results.
type ModelDocumentFactories<RawModel, DocType> = Pick<
  mongoose.Model<
    DocType,
    ModelHelpers<RawModel>,
    {},
    {},
    StrictDocument<DocType, ModelDocument<RawModel, DocType>>
  >,
  'create' | 'hydrate' | 'insertMany' | 'insertOne'
>;

/**
 * A type-safe wrapper for Mongoose Models that provides fluent population tracking.
 */
export type StrictModel<RawModel, DocType> = Omit<
  RawModel,
  | keyof ModelQueryOverrides<DocType, ModelHelpers<RawModel>, ModelDocument<RawModel, DocType>>
  | keyof ModelDocumentFactories<RawModel, DocType>
> &
  ModelConstructor<RawModel, DocType> &
  ModelDocumentFactories<RawModel, DocType> &
  ModelQueryOverrides<DocType, ModelHelpers<RawModel>, ModelDocument<RawModel, DocType>>;

// ============================================================================
// 6. INITIALIZATION RUNTIME COMPONENT
// ============================================================================

/**
 * Converts a standard Mongoose model into a `StrictModel` with advanced type-safe population.
 *
 * Infers document and extension types from the supplied schema. When specifying the
 * document type explicitly, also pass `typeof schema` as the second type argument
 * to preserve schema extensions.
 *
 * @template UserInferredType An optional explicit document type.
 * @template TSchema The concrete Mongoose schema type.
 * @param name The model name to register or retrieve from Mongoose.
 * @param mongooseSchema The Mongoose schema instance.
 * @returns A `StrictModel` instance with enhanced type safety for population.
 *
 * @example
 * ```typescript
 * const PostModel = toStrictModel('Post', postSchema);
 * const post = await PostModel.findOne().populate('author').exec();
 * // post.author is now fully typed
 * ```
 */
export function toStrictModel<
  UserInferredType = never,
  TSchema extends mongoose.Schema = mongoose.Schema<UserInferredType>,
>(name: string, mongooseSchema: TSchema) {
  const m = getMongoose() as typeof mongoose | null;
  if (!m) {
    throw new Error('Mongoose must be installed to use toStrictModel.');
  }
  const rawModel = m.model(name, mongooseSchema);
  return rawModel as unknown as StrictModel<
    typeof rawModel,
    [UserInferredType] extends [never] ? mongoose.InferSchemaType<TSchema> : UserInferredType
  >;
}
