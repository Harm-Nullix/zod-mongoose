---
title: API Reference
description: The complete API reference for @nullix/zod-mongoose.
---

# API Reference

Below is an overview of the available functions and helpers in `@nullix/zod-mongoose`.

### `toMongooseSchema(zodSchema, options?)`
Converts a Zod schema to a Mongoose schema instance (`new mongoose.Schema(...)`).
- `zodSchema`: A Zod object or any Zod type.
- `options`: Optional Mongoose `SchemaOptions`.

> **Note:** This function replaces the deprecated `toZodMongooseSchema()`. It now returns a full `mongoose.Schema` instance directly.

### `extractMongooseDef(zodSchema)`
Converts a Zod schema to a Mongoose schema definition object (the POJO used as the first argument for `new mongoose.Schema(...)`).

### `withMongoose(zodSchema, metadata)`
Attaches Mongoose-specific metadata to any Zod schema.
- `metadata`: A `MongooseMeta` object.

> **Note:** To define a custom Mongoose type, use `withMongoose(zodSchema, { type: 'YourType' })` instead of the deprecated `mongooseZodCustomType()`.

### `zObjectId(options?)`
Helper to create a Zod schema representing a Mongoose `ObjectId`.

### `zPopulated(ref, schema, options?)`
Helper for fields that can be either an `ObjectId` (unpopulated) or a populated object.

### `zBuffer(options?)`
Helper to create a Zod schema representing a Mongoose `Buffer`.

### `setFrontendMode(enabled)`
Enable or disable frontend mode. In frontend mode, `zObjectId` falls back to a regex-validated string and `zBuffer` to `Uint8Array`.

### `genTimestampsSchema(createdAtField?, updatedAtField?)`
Returns an object with timestamp fields. This makes it easy to include timestamps in `z.object()`.
