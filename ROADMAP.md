# Roadmap

This roadmap reflects the code on `main`. Features are marked as shipped only when they are available in a released version; proposed work is deliberately kept separate from the public API.

## Current release: v3.1.0

v3.1.0 introduced `InferDocument<T>` and `InferInput<T>`. It also deprecated `setFrontendMode()` and the legacy `InferMongoose<T>`, `OutputMongoose<T>`, and `InputMongoose<T>` aliases. Conditional exports continue to select the browser-safe implementation automatically.

The previously proposed `@nullix/zod-mongoose/nuxt` entry point is not part of the current package exports, so it is not a v3.1 feature or a v4 removal target.

## Already available

- **Full Zod lifecycle validation:** `toMongooseSchema()` runs `schema.parse()` in a Mongoose `post('validate')` hook by default. This covers Zod features that cannot be expressed as Mongoose schema options, including refinements and transforms. Set `validateBeforeSave: false` in conversion options or `withMongoose()` metadata to opt out. This has been available since v2.5.0; there is no separate `runZodValidate` option planned.
- **References and populated results:** `zRef()` defines an ObjectId reference and keeps the target Zod schema as metadata. `PopulatedSchema<T, K>` types populated results, `populateZodSchema()` validates populated data at runtime, and `toStrictModel()` provides fluent type-safe population. `zPopulated` was replaced in v2.3.0 and should not be reintroduced.
- **Mongoose-specific metadata:** `withMongoose(schema, metadata)` stores field and schema options in the Zod registry without extending Zod prototypes. It supports normal Mongoose options such as `index`, `unique`, `ref`, `timestamps`, `collection`, and nested-schema configuration.
- **Specialized MongoDB bridges:** `zObjectId()`, `zBuffer()`, and `zRef()` are available in both server and browser-safe entry points.
- **Virtuals and extensions:** Mongoose plugins can be passed to `toMongooseSchema()`. The `schema:created` hook receives the generated `mongoose.Schema`, where consumers can define virtuals and other Mongoose-specific behavior. There is no `.mongooseVirtual()` API or `virtuals`/`indexes` conversion option today.

## v3.2 — proposed

- **GeoJSON helpers:** Add `zPoint()` and `zPolygon()` as standalone MongoDB type bridges, including the Mongoose GeoJSON type metadata needed for conversion. Their API should use `withMongoose()`/the registry and must not patch Zod prototypes.

No version has been assigned to a type-safe query-filter helper. A future `zFilter()` proposal needs a concrete API and compatibility review before it is added to the release roadmap.

## v4.0 — planned breaking cleanup

- Remove `setFrontendMode()`.
- Remove the deprecated `InferMongoose<T>`, `OutputMongoose<T>`, and `InputMongoose<T>` aliases in favor of `InferDocument<T>` and `InferInput<T>`.

Other ideas, including a schema-diagnostics CLI, remain exploratory and are not committed v4.0 scope.

## Principles

- Keep the core focused on generating, typing, and validating Mongoose schemas.
- Prefer native Zod constructs when Zod already models the data shape.
- Add helpers only for MongoDB/Mongoose concepts that Zod does not model, such as ObjectIds and GeoJSON.
- Keep Mongoose configuration in functional metadata and hooks; do not mutate Zod prototypes.