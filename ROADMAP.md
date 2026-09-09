# Core Principles for v4.0

* Micro-kernel First: Anything that does not generate, type, or validate a Mongoose schema does not belong in the core package.
* Zero Overhead: The conversion engine stays as close as possible to native Mongoose Schema() performance.
* DX Over Feature Count: 10 perfectly executed MongoDB bridges over 100 superficial utilities.

| **Version** | **Change Type**                  | **Actions & Features**                      | **Reason & SemVer Rules**                                                                            |
|-------------|----------------------------------|---------------------------------------------|------------------------------------------------------------------------------------------------------|
| v3.1  💚    | Minor (Deprecations & Additions) | Introduce @nullix/zod-mongoose/nuxt subpath | Existing code remains 100% functional. Developers get clear deprecation notices and time to migrate. |
|             |                                  | Deprecate core Nuxt import                  |                                                                                                      |
|             |                                  | Deprecate setFrontendMode() (log warning)   |                                                                                                      |
|             |                                  | Add InferDocument<T> and InferInput<T>      |                                                                                                      |
| v3.2  🏗️    | Minor (New Features)             | Add .mongooseVirtual() for virtual fields   | API expansion. Fully backward-compatible.                                                            |
|             |                                  | Add zPopulated<T, Field> type helper        |                                                                                                      |
| v3.3  🔴    | Minor (New Features)             | Add runZodValidate: true option             | New functionality added without altering existing behavior.                                          |
|             |                                  | Add zFilter<T>() type-safe query helper     |                                                                                                      |
| v4.0  🔴    | Major (Breaking Changes)         | Remove setFrontendMode() permanently        | Major cleanup. Users consciously upgrade to v4 expecting migration steps.                            |
|             |                                  | Remove Nuxt exports from the core bundle    |                                                                                                      |
|             |                                  | Remove legacy/duplicate type utilities      |                                                                                                      |
|             |                                  | Launch npx zod-mongoose check CLI tool      |                                                                                                      |


Here is a detailed breakdown of each roadmap item, organized into clear sections.

---

## 1. Frontend Detection & Automatic Exports

### What Changes?

In version 3.0, the package relies on a manual function called `setFrontendMode()` to inform the conversion engine whether it is running in a browser or Node.js environment. Starting in v3.1, this function will be marked as **deprecated**, triggering a console warning. In v4.0, it will be **removed entirely**.

### Why Are We Doing This?

Requiring manual runtime configuration leads to frustrating bugs when developers forget to toggle the flag. Modern JavaScript bundlers (such as Vite, Webpack, and Rollup) and runtime environments natively support conditional exports (`browser` and `default` conditions) in `package.json`. This allows the runtime to select the correct implementation automatically without requiring any manual setup from the developer.

---

## 2. Framework Integrations (Nuxt / Nitro)

### What Changes?

Framework-specific integrations—such as dedicated helpers for Nuxt 4 or Nitro—will move out of the core export and into an optional subpath import: `@nullix/zod-mongoose/nuxt`. In v3.1, importing these helpers directly from the core package will be deprecated, and in v4.0, the legacy exports will be removed from the core bundle completely.

### Why Are We Doing This?

A primary goal for v4.0 is adhering to a **micro-kernel architecture**: keeping the package core as light, fast, and lean as possible. Developers using NestJS, Express, or Fastify should not have their installations bloated with code or type definitions specifically meant for Nuxt.

---

## 3. Type Inference API Consolidation

### What Changes?

Currently, there are overlapping type utilities and generics available to infer TypeScript types from a schema. Starting in v3.1, two clear standard generics are being introduced:

* `InferDocument<typeof Schema>`: Infers the final Mongoose document type (including auto-generated `_id` and timestamps).
* `InferInput<typeof Schema>`: Infers the raw input payload (ideal for API request bodies where `_id` does not yet exist).

In v4.0, all legacy or duplicate type aliases will be removed.

### Why Are We Doing This?

This significantly reduces cognitive overload for developers. Instead of guessing which type utility to import, they have two intuitive options that explicitly state what they do.

---

## 4. Virtuals Bridge (`.mongooseVirtual()`)

### What Changes?

A new fluent schema modifier is being introduced: `.mongooseVirtual()`. This allows you to define Mongoose getters and setters for computed virtual fields (such as `fullName` generated from `firstName` and `lastName`) directly within your Zod schema definition.

### Why Are We Doing This?

Currently, virtual fields often have to be attached manually to the generated Mongoose schema after conversion, which breaks TypeScript type inference. With `.mongooseVirtual()`, your schema definition, Mongoose runtime behavior, and TypeScript types stay synchronized in one central location.

---

## 5. Population Inference (`zPopulated`)

### What Changes?

In v3.2, we are introducing the `zPopulated<T, 'relationField'>` utility. When you retrieve a Mongoose document and execute `.populate('author')`, the `author` field transitions from an `ObjectId` (string) into a fully hydrated `User` document. This utility ensures TypeScript reflects that populated state accurately.

### Why Are We Doing This?

Typing populated relations has historically been one of the biggest pain points in the Mongoose and TypeScript ecosystem. Developers frequently have to resort to manual type casting (`as unknown as ...`). This utility solves that issue cleanly and type-safely.

---

## 6. Zod Lifecycle Validation (`runZodValidate`)

### What Changes?

A new option is being added to the conversion function: `toMongooseSchema(Schema, { runZodValidate: true })`. When enabled, advanced Zod validation rules—such as `.refine()`, `.superRefine()`, and `.transform()`—are automatically executed during Mongoose's native `.save()` or `.validate()` lifecycle.

### Why Are We Doing This?

By default, `zodMongoose` maps Zod structural types to Mongoose Schema Types. However, native Mongoose lacks built-in awareness for custom Zod refinements. Enabling this option guarantees that Mongoose enforces the exact same validation logic as your Zod schemas on the frontend without forcing you to write duplicate validation code.

---

## 7. Type-Safe Query Filters (`zFilter`)

### What Changes?

In v3.3, we will introduce the `zFilter<typeof Schema>()` function. This helper provides autocomplete and strict type checking when writing Mongoose queries using MongoDB operators like `$in`, `$gt`, `$ne`, or `$exists`.

### Why Are We Doing This?

While developers use Zod to define their schemas safely, writing `Model.find({ age: { $gt: "invalid-string" } })` often bypasses TypeScript's safety nets. `zFilter` extends the type safety defined in your Zod schema directly into your database querying layer.

---

## 8. CLI Schema Diagnostics (`npx zod-mongoose check`)

### What Changes?

Alongside the v4.0 GA launch, we are releasing a standalone CLI tool executable via `npx zod-mongoose check`. This tool scans your codebase for Zod schemas and checks for potential conversion mismatches with Mongoose.

### Why Are We Doing This?

Certain Zod constructs (such as highly complex nested unions or specific custom transformations) cannot be translated 1-to-1 into Mongoose schema constraints. Rather than discovering these limitations at runtime or in production, the CLI diagnostic tool warns developers early during build or CI/CD pipelines.