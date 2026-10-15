# Roadmap

This roadmap reflects the code on `main`. Features are marked as shipped only when they are available in a released version; proposed work is deliberately kept separate from the public API.

## Current release: v3.3.4

v3.1.0 introduced `InferDocument<T>` and `InferInput<T>`. It also deprecated `setFrontendMode()` and the legacy `InferMongoose<T>`, `OutputMongoose<T>`, and `InputMongoose<T>` aliases. Conditional exports continue to select the browser-safe implementation automatically.

The previously proposed `@nullix/zod-mongoose/nuxt` entry point is not part of the current package exports, so it is not a v3.1 feature or a v4 removal target.

## Already available

- **Zod document validation:** `toMongooseSchema()` validates stored values in a Mongoose `post('validate')` hook by default, including field and object refinements. In v3.4, pipes and codecs validate their declared output without rerunning input transforms. Parse transformed input before storage; see the [validation guide](packages/docs/content/2.guides/1.validation.md). Set `validateBeforeSave: false` in conversion options or metadata to disable the extra hook.
- **References and populated results:** `zRef()` defines an ObjectId reference and keeps the target Zod schema as metadata. `PopulatedSchema<T, K>` types populated results, `populateZodSchema()` validates populated data at runtime, and `toStrictModel()` provides fluent type-safe population. `zPopulated` was replaced in v2.3.0 and should not be reintroduced.
- **Mongoose-specific metadata:** `withMongoose(schema, metadata)` stores field and schema options in the Zod registry without extending Zod prototypes. It supports normal Mongoose options such as `index`, `unique`, `ref`, `timestamps`, `collection`, and nested-schema configuration.
- **Specialized MongoDB bridges:** `zObjectId()`, `zBuffer()`, and `zRef()` are available in both server and browser-safe entry points.
- **Virtuals and extensions:** Mongoose plugins can be passed to `toMongooseSchema()`. The `schema:created` hook receives the generated `mongoose.Schema`, where consumers can define virtuals and other Mongoose-specific behavior. There is no `.mongooseVirtual()` API or `virtuals`/`indexes` conversion option today.

## v3.2 — implementation complete

- **GeoJSON helpers:** `zPoint()` and `zPolygon()` provide standalone MongoDB type bridges with Mongoose GeoJSON metadata. They use `withMongoose()`/the registry and do not patch Zod prototypes. The feature was motivated by a [request for GeoJSON types](https://github.com/git-zodyac/mongoose/issues/31). See the [helper reference](packages/docs/content/3.api/3.specialized-helpers.md#geojson-helpers) for usage.

## v3.2.1 — implementation complete

- **Buffer validation fix:** `zBuffer()` accepts BSON `Binary` values from Mongoose `document.toObject()`, so the default Zod validation hook accepts edited Buffer fields.

## v3.3 — implementation complete

- **Unknown-key behavior:** `z.strictObject()` rejects unknown fields, while `z.looseObject()` and `.catchall()` preserve them in top-level and nested Mongoose documents. Typed catchall values are checked during document validation. Mongoose-generated IDs, version keys, and timestamps are excluded from that Zod check unless declared in the corresponding Zod shape.
- **Object field wrappers:** `.required()` and `exactOptional()` retain their underlying Mongoose types. Exact optional fields reject explicit `undefined` on document assignment.
- **Derived object schemas:** `.extend()`, `.safeExtend()`, `.pick()`, `.omit()`, and `.partial()` inherit the resulting Zod object's unknown-key policy. See the [object modes guide](packages/docs/content/2.guides/9.object-modes.md) for storage behavior and query-update caveats.

## v3.4 — implementation complete

**Predictable stored values:** conversion preserves valid values and avoids guessing transform return types. [Schema conversion compatibility](packages/core/test/schema-conversion-compatibility.test.ts) and [stored-value lifecycle](packages/core/test/storage-lifecycle.test.ts) coverage run as part of the normal unit suite: `pnpm --filter @nullix/zod-mongoose test:unit`. See the [decisions and original findings](packages/core/test/roadmap-3.4.md).

- **Array presence and defaults:** required arrays reject omission; optional arrays remain omitted. Use `.default([])` to request an empty-list default. Element defaults and options stay separate from their containing array, including primitive-union definitions. Valid empty arrays and length checks retain their behavior.
- **Tuple values:** heterogeneous and position-constrained tuples preserve their element types through Mixed array storage. Unconstrained homogeneous primitive tuples retain native casting, including GeoJSON coordinates. Zod checks tuple positions and length during document validation.
- **Transform output:** parse input once before storage. Pipes, preprocessors, and codecs validate declared output without rerunning input callbacks. Bare callbacks map to Mixed and need `.pipe(outputSchema)` for automatic output typing and validation. Whole-object transforms require an output object pipe. Explicit Mongoose types control casting, without supplying an output validation schema.
- **Strings and enums:** valid empty strings pass presence checks while missing required values still fail. Numeric enums retain numbers; nullable enums retain null support. Both current and older ISO string format syntax preserve strings.
- **Literal constraints:** primitive literals use native types and enforce declared values even with the Zod hook disabled. Defaults remain explicit; optional/nullable wrappers and multi-value literals retain their semantics.
- **Casting compatibility:** native Mongoose primitive Union casting remains available for direct construction and query filters. Parse input with Zod first when strict raw-input validation is required. Conversion does not impose a new global casting policy.

The original red tests included proposals for implicit literal defaults and strict union casting. Those assertions were revised to match the contracts above. The [validation guide](packages/docs/content/2.guides/1.validation.md) explains the input/output boundary; the [migration notes](packages/docs/content/2.guides/8.migration.md#upgrade-to-v34) highlight array and transform changes.

## v3.5 — implementation complete

- **Type-safe query-filter helper:** `InferQueryFilter<T>` (and alias `InferFilter<T>`) provides compile-time MongoDB query filter types (`mongoose.QueryFilter<InferDocument<T>>`) derived directly from Zod document schemas. It complements `InferInput<T>` and `InferDocument<T>` with zero runtime overhead.

## v4.0 — planned breaking cleanup

- Remove `setFrontendMode()`.
- Remove the deprecated `InferMongoose<T>`, `OutputMongoose<T>`, and `InputMongoose<T>` aliases in favor of `InferDocument<T>` and `InferInput<T>`.

Other ideas, including a schema-diagnostics CLI, remain exploratory and are not committed v4.0 scope.

## Principles

- Keep the core focused on generating, typing, and validating Mongoose schemas.
- Prefer native Zod constructs when Zod already models the data shape.
- Add helpers only for MongoDB/Mongoose concepts that Zod does not model, such as ObjectIds and GeoJSON.
- Keep Mongoose configuration in functional metadata and hooks; do not mutate Zod prototypes.
- Keep Mongoose `SchemaOptions` as permissive as possible for edge cases (e.g., arrays and nullable types) to prevent runtime friction, delegating strict validation to the built-in Zod lifecycle hook (`schema.parse()`).