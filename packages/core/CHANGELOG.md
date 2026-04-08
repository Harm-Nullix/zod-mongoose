## 1.0.11

### Patch Changes

- 9525d1e: try fixing parse.post

## 1.0.10

### Patch Changes

- a3f1f4e: github pages and manul tagging

## 1.0.9

### Patch Changes

- 47118c7: manual git tags

## 1.0.8

### Patch Changes

- 6451775: update doc actions

## 1.0.7

### Patch Changes

- b756ee6: update relawsee steps

## 1.0.6

### Patch Changes

- cdda32f: Docs are now build with release for synced deployment later on, try fix wierd pnpm static error code
- 7f5f372: update doc build

## 1.0.5

### Patch Changes

- 12bbcad: update playground and relasese steps

## 1.0.4

### Patch Changes

- 2f60bea: add acces public to release step
- 2f60bea: v6 for release

## 1.0.3

### Patch Changes

- bae8d27: update repo url and captial

## 1.0.2

### Patch Changes

- 9d754b9: update npm registry

## 1.0.1

### Patch Changes

- 3454377: do not build docs for release

## 1.0.0

### Major Changes

- 038e1f4: Initial release of zod-mongoose for public use

### Patch Changes

- 52d8187: release version updates
- 7a9de05: release and docs updates
- 76368d7: internal changes for release

## 0.2.0

- Renamed package to `@nullix/zod-mongoose`.
- Migrated to `Harm-Nullix/zod-mongoose` repository.
- Full support for Zod v4 and Mongoose 8.
- Added Hookable system for extensible conversion.
- Added `PopulatedSchema` utility type.
- Simplified `_id` handling.

## 0.1.1 (mongoose-zod)

- Added the ability to opt out of zod prototype extension and set the default `toMongooseSchema` options in `setup` function.

## 0.1.0

- When using `.lean()`, for fields of `Buffer` type an actual `Buffer` instance is returned instead of `Binary`.
- Prevent `mongoose-lean-defaults` from setting `undefined` to the missing fields.
- Merge type options set multiple times with `.mongooseTypeOptions()`.
- Make sure `genTimestampsSchema` sets the correct `timestamps` schema option in addition.
- All generated mongoose schemas now have `strict` option set to `throw`. There's an option to override this behaviour for all the schemas or per a schema basis.

## 0.0.7

## 0.0.6

- Fixed an erroneous sub schema validation error if one of its fields has `Buffer` type.

## 0.0.5

- Fix the issue resulting in fields with custom types set via `mongooseZodCustomType` still having `Mixed` type in the resulting schema.
- Fields assigned a `Buffer` mongoose type now have a native `Buffer` TypeScript type.

## 0.0.4

- Fix ESM & DTS outputs.

## 0.0.3

- Add type-safe alternatives for `validate`/`required` type options: `mzValidate` and `mzRequired`.
- Set `minimize: false` in schema options by default.
- Detect if the following plugins are installed and automatically register them on created schemas: `mongoose-lean-virtuals`, `mongoose-lean-defaults`, `mongoose-lean-getters`.
- Set `virtuals: true`, `defaults: true` and `getters: true` automatically when using `.lean()` query method if respective plugins are installed as well as `versionKey: false`.

## 0.0.2

- Throw an error upon schema generation if zod's `.optional()` is used but mongoose's `required` set to true or vice versa.
- Switch to using native mongoose types for number/string/boolean/date with value casting disabled to fix type specific operators not recognized by mongoose.

## 0.0.1

Initial release.
