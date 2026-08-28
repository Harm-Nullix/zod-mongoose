# @nullix/zod-mongoose-studio

## 2.6.0

### Minor Changes

- 1e7d05a: Add `discriminatorModelPrefix` option for Mongoose discriminators to avoid global model name collisions; update docs and tests accordingly.

### Patch Changes

- Updated dependencies [1e7d05a]
  - @nullix/zod-mongoose@2.6.0

## 2.5.6

### Patch Changes

- ff6e010: Add request-scoping via parse lock; ensure hook cleanup and improve error handling in parse API
- Updated dependencies [ff6e010]
  - @nullix/zod-mongoose@2.5.6

## 2.5.5

### Patch Changes

- d98f4cb: Enhance discriminated union handling in schema extraction; add tests for complex base schemas, nested schemas, and zRef integration; refactor for type prettification and schema comparison.
- Updated dependencies [d98f4cb]
  - @nullix/zod-mongoose@2.5.5

## 2.5.4

### Patch Changes

- 730becc: Added helpers for infer functions so z.infer makes a oBjectId
- Updated dependencies [730becc]
  - @nullix/zod-mongoose@2.5.4

## 2.5.3

### Patch Changes

- ed34d59: Add frontend resolver for paths
- Updated dependencies [ed34d59]
  - @nullix/zod-mongoose@2.5.3

## 2.5.2

### Patch Changes

- 5b4fa25: import order issue fixed
- Updated dependencies [5b4fa25]
  - @nullix/zod-mongoose@2.5.2

## 2.5.1

### Patch Changes

- 44957ba: docs update auto validate feature
- Updated dependencies [44957ba]
  - @nullix/zod-mongoose@2.5.1

## 2.5.0

### Minor Changes

- 4c261d5: validate before save

### Patch Changes

- Updated dependencies [4c261d5]
  - @nullix/zod-mongoose@2.5.0

## 2.4.2

### Patch Changes

- d5d243c: Prevent mongoose from loading in frontend
- Updated dependencies [d5d243c]
  - @nullix/zod-mongoose@2.4.2

## 2.4.1

### Patch Changes

- 8a58fa4: Refactor: split `mongoose-helpers` for isomorphic usage, enhance `zObjectId`/`zRef`, and update docs formatting.
- Updated dependencies [8a58fa4]
  - @nullix/zod-mongoose@2.4.1

## 2.4.0

### Minor Changes

- 7038069: Add `toStrictModel` for type-safe population in Mongoose models with Zod validation.

### Patch Changes

- Updated dependencies [7038069]
  - @nullix/zod-mongoose@2.4.0

## 2.3.0

### Minor Changes

- dd50bd6: Replace `zPopulated` with `zRef`, add `populateZodSchema`, and refactor metadata extraction with `getMongooseMeta`

### Patch Changes

- Updated dependencies [dd50bd6]
  - @nullix/zod-mongoose@2.3.0

## 2.2.0

### Minor Changes

- 80db1a8: Records are now POJO instead of converted to maps

### Patch Changes

- 76c7732: Transform and coarce fixes
- Updated dependencies [76c7732]
- Updated dependencies [80db1a8]
  - @nullix/zod-mongoose@2.2.0

## 2.1.0

### Minor Changes

- 986bb88: z.object to subschema unless speficfied

### Patch Changes

- 986bb88: make meta for withMongoose optional
- Updated dependencies [986bb88]
- Updated dependencies [986bb88]
  - @nullix/zod-mongoose@2.1.0

## 2.0.0

### Major Changes

- Major release for Mongoose 9 support.

### Patch Changes

- Updated dependencies
  - @nullix/zod-mongoose@2.0.0

## 1.0.13

### Patch Changes

- 170518d: remove test from prepublishOnly script
- Updated dependencies [170518d]
  - @nullix/zod-mongoose@1.0.13

## 1.0.12

### Patch Changes

- 46f3323: Update tag checking
- Updated dependencies [46f3323]
  - @nullix/zod-mongoose@1.0.12

## 1.0.11

### Patch Changes

- 9525d1e: try fixing parse.post
- Updated dependencies [9525d1e]
  - @nullix/zod-mongoose@1.0.11

## 1.0.10

### Patch Changes

- a3f1f4e: github pages and manul tagging
- Updated dependencies [a3f1f4e]
  - @nullix/zod-mongoose@1.0.10

## 1.0.9

### Patch Changes

- 47118c7: manual git tags
- Updated dependencies [47118c7]
  - @nullix/zod-mongoose@1.0.9

## 1.0.8

### Patch Changes

- 6451775: update doc actions
- Updated dependencies [6451775]
  - @nullix/zod-mongoose@1.0.8

## 1.0.7

### Patch Changes

- b756ee6: update relawsee steps
- Updated dependencies [b756ee6]
  - @nullix/zod-mongoose@1.0.7

## 1.0.6

### Patch Changes

- cdda32f: Docs are now build with release for synced deployment later on, try fix wierd pnpm static error code
- 7f5f372: update doc build
- Updated dependencies [cdda32f]
- Updated dependencies [7f5f372]
  - @nullix/zod-mongoose@1.0.6

## 1.0.5

### Patch Changes

- 12bbcad: update playground and relasese steps
- Updated dependencies [12bbcad]
  - @nullix/zod-mongoose@1.0.5

## 1.0.4

### Patch Changes

- 2f60bea: add acces public to release step
- 2f60bea: v6 for release
- Updated dependencies [2f60bea]
- Updated dependencies [2f60bea]
  - @nullix/zod-mongoose@1.0.4

## 1.0.3

### Patch Changes

- bae8d27: update repo url and captial
- Updated dependencies [bae8d27]
  - @nullix/zod-mongoose@1.0.3

## 1.0.2

### Patch Changes

- 9d754b9: update npm registry
- Updated dependencies [9d754b9]
  - @nullix/zod-mongoose@1.0.2

## 1.0.1

### Patch Changes

- 3454377: do not build docs for release
- Updated dependencies [3454377]
  - @nullix/zod-mongoose@1.0.1

## 1.0.0

### Major Changes

- 038e1f4: Initial release of zod-mongoose for public use

### Patch Changes

- 52d8187: release version updates
- 7a9de05: release and docs updates
- 76368d7: internal changes for release
- Updated dependencies [52d8187]
- Updated dependencies [038e1f4]
- Updated dependencies [7a9de05]
- Updated dependencies [76368d7]
  - @nullix/zod-mongoose@1.0.0
