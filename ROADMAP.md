# Core Principles for v4.0

* Micro-kernel First: Anything that does not generate, type, or validate a Mongoose schema does not belong in the core package.
* Zero Overhead: The conversion engine stays as close as possible to native Mongoose Schema() performance.
* DX Over Feature Count: 10 perfectly executed MongoDB bridges over 100 superficial utilities.

| **Version** | **Change Type**                  | **Actions & Features**                      | **Reason & SemVer Rules**                                                                            |
|-------------|----------------------------------|---------------------------------------------|------------------------------------------------------------------------------------------------------|
| v3.1        | Minor (Deprecations & Additions) | Introduce @nullix/zod-mongoose/nuxt subpath | Existing code remains 100% functional. Developers get clear deprecation notices and time to migrate. |
|             |                                  | Deprecate core Nuxt import                  |                                                                                                      |
|             |                                  | Deprecate setFrontendMode() (log warning)   |                                                                                                      |
|             |                                  | Add InferDocument<T> and InferInput<T>      |                                                                                                      |
| v3.2        | Minor (New Features)             | Add .mongooseVirtual() for virtual fields   | API expansion. Fully backward-compatible.                                                            |
|             |                                  | Add zPopulated<T, Field> type helper        |                                                                                                      |
| v3.3        | Minor (New Features)             | Add runZodValidate: true option             | New functionality added without altering existing behavior.                                          |
|             |                                  | Add zFilter<T>() type-safe query helper     |                                                                                                      |
| v4.0        | Major (Breaking Changes)         | Remove setFrontendMode() permanently        | Major cleanup. Users consciously upgrade to v4 expecting migration steps.                            |
|             |                                  | Remove Nuxt exports from the core bundle    |                                                                                                      |
|             |                                  | Remove legacy/duplicate type utilities      |                                                                                                      |
|             |                                  | Launch npx zod-mongoose check CLI tool      |                                                                                                      |