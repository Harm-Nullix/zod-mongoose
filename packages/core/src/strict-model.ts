import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import type {QueryFilter, ProjectionType, QueryOptions, UpdateQuery, Query} from 'mongoose';
import {ZRefBrand} from './mongoose-helpers.shared.js';
import {getMongoose} from './config.js';
import {PrettifyType} from './index.js';

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
      ? Head extends keyof DocType
        ? `${Head}.${ValidatePath<z.infer<GetTargetSchema<DocType, Head>>, Tail>}`
        : ExtractPopulatePaths<DocType>
      : P extends keyof DocType
        ? P
        : ExtractPopulatePaths<DocType>;

/** Handles dot-notation paths like 'author.user' and wraps levels uniformly in StrictDocument */
type HydrateDotPath<Base, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof Base
    ? Head extends string
      ? Omit<Base, Head> & {
          [K in Head]: Base[Head] extends Array<any>
            ? StrictDocument<HydrateDotPath<z.infer<GetTargetSchema<Base, Head>>, Tail>>[]
            :
                | StrictDocument<HydrateDotPath<z.infer<GetTargetSchema<Base, Head>>, Tail>>
                | (Base[Head] & (null | undefined));
        }
      : Base
    : Base
  : Path extends keyof Base
    ? Path extends string
      ? HydratePopulatedPath<Base, Path>
      : Base
    : Base;

/** Sequentially runs multiple path hydrations down an array tuple sequence */
export type HydrateMultiplePaths<Base, Paths extends string[]> = Paths extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends string
    ? Tail extends string[]
      ? HydrateMultiplePaths<HydrateDotPath<Base, Head>, Tail>
      : HydrateDotPath<Base, Head>
    : Base
  : Base;

// ============================================================================
// 2. CORE SCHEMA EXTRACTORS
// ============================================================================

/** Identifies keys within a shape that are explicitly marked as ZRefs */
export type ExtractPopulatePaths<T> = {
  [K in keyof T]: NonNullable<UnwrapArray<T[K]>> extends ZRefBrand<any> | Partial<ZRefBrand<any>>
    ? K
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

/** Swaps a target primitive/ID field for its fully inferred Zod counterpart wrapped in StrictDocument */
export type HydratePopulatedPath<Base, K extends keyof Base> = Omit<Base, K> & {
  [P in K]: Base[P] extends Array<any>
    ? StrictDocument<z.infer<GetTargetSchema<Base, P>>>[]
    : StrictDocument<z.infer<GetTargetSchema<Base, P>>> | (Base[P] & (null | undefined));
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

export type PopulateOptions<DocType> = PopulateObject<DocType> | PopulateObject<DocType>[];

/** Evaluates standard inputs, spaces, dots, and objects to output the resulting structure */
type DeterminePopulatedResult<DocType, P> = P extends string
  ? HydrateMultiplePaths<DocType, SplitSpaces<P>>
  : P extends {path: infer PathKey}
    ? PathKey extends keyof DocType
      ? PathKey extends string
        ? P extends {populate: any}
          ? Omit<DocType, PathKey> & {
              [K in PathKey]: DocType[K] extends Array<any>
                ? StrictDocument<
                    DeterminePopulatedResult<
                      z.infer<GetTargetSchema<DocType, PathKey>>,
                      P['populate']
                    >
                  >[]
                :
                    | StrictDocument<
                        DeterminePopulatedResult<
                          z.infer<GetTargetSchema<DocType, PathKey>>,
                          P['populate']
                        >
                      >
                    | (DocType[K] & (null | undefined));
            }
          : HydratePopulatedPath<DocType, PathKey>
        : DocType
      : DocType
    : DocType;

// ============================================================================
// 4. MAIN INTERACTION INTERFACES
// ============================================================================

/**
 * An enhanced Mongoose Document type that tracks population state.
 *
 * @template DocType The Zod-inferred document type.
 */
export type StrictDocument<DocType> = PrettifyType<
  PrettifyType<Omit<mongoose.Document, 'populate'>> &
    DocType & {
      /**
       * Populates document references and returns a document with updated type information.
       *
       * @param path The path(s) to populate. Supports dot notation, spaces, and recursive objects.
       */
      populate<P extends string | PopulateOptions<DocType>>(
        path: P extends string ? ValidatePath<DocType, P> : P,
      ): Promise<StrictDocument<DeterminePopulatedResult<DocType, P>>>;
    }
>;

/**
 * An enhanced Mongoose Query type that tracks population state.
 *
 * @template Result The current result type of the query.
 * @template DocType The base document type.
 */
export type StrictQuery<Result, DocType, Helpers = {}, RawDoc = {}> = Omit<
  Query<Result, any, Helpers, RawDoc>,
  'populate' | 'exec'
> & {
  /**
   * Populates document references and returns a query with updated result type information.
   *
   * @param path The path(s) to populate. Supports dot notation, spaces, and recursive objects.
   */
  populate<P extends string | PopulateOptions<DocType>>(
    path: P extends string ? ValidatePath<DocType, P> : P,
  ): StrictQuery<
    Result extends Array<any>
      ? StrictDocument<DeterminePopulatedResult<DocType, P>>[]
      : StrictDocument<DeterminePopulatedResult<DocType, P>> | (Result & (null | undefined)),
    DeterminePopulatedResult<DocType, P>,
    Helpers,
    RawDoc
  >;

  /**
   * Executes the query and returns the populated result.
   */
  exec(): Promise<Result>;
};

// ============================================================================
// 5. EXPLICIT ENTRY POINT QUERY OVERRIDES
// ============================================================================

interface ModelQueryOverrides<DocType> {
  find(
    filter?: QueryFilter<DocType>,
    projection?: ProjectionType<DocType> | null,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType>[], DocType>;

  findOne(
    filter?: QueryFilter<DocType>,
    projection?: ProjectionType<DocType> | null,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType> | null, DocType>;

  findById(
    id: any,
    projection?: ProjectionType<DocType> | null,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType> | null, DocType>;

  findOneAndUpdate(
    filter?: QueryFilter<DocType>,
    update?: UpdateQuery<DocType>,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType> | null, DocType>;

  findByIdAndUpdate(
    id: any,
    update?: UpdateQuery<DocType>,
    options?: QueryOptions<DocType> | null,
  ): StrictQuery<StrictDocument<DocType> | null, DocType>;
}

/**
 * A type-safe wrapper for Mongoose Models that provides fluent population tracking.
 */
export type StrictModel<RawModel, DocType> = Omit<RawModel, keyof ModelQueryOverrides<DocType>> &
  ModelQueryOverrides<DocType>;

// ============================================================================
// 6. INITIALIZATION RUNTIME COMPONENT
// ============================================================================

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
export function toStrictModel<UserInferredType>(name: string, mongooseSchema: mongoose.Schema) {
  const m = getMongoose();
  if (!m) {
    throw new Error('Mongoose must be installed to use toStrictModel.');
  }
  const rawModel = m.model(name, mongooseSchema);
  return rawModel as unknown as StrictModel<typeof rawModel, UserInferredType>;
}
