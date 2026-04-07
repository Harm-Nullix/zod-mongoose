---
title: Studio
description: Discover the @nullix/zod-mongoose-studio for visualizing transformations.
---

# Studio

`@nullix/zod-mongoose-studio` is a powerful, Monaco-powered TypeScript playground for testing and visualizing Zod-to-Mongoose transformations. It provides a real-time editor experience where you can define your Zod schemas and instantly see the resulting Mongoose schema definition.

## Installation

The Studio is available as a separate package that you can add to your development environment.

```bash
pnpm add @nullix/zod-mongoose-studio
```

## Usage

You can use the Studio as a standalone component or integrate it into your own Nuxt or Vue applications.

### Standalone Development

If you're working within the `zod-mongoose` monorepo, you can start the Studio by running:

```bash
pnpm run dev
```

This will launch the playground environment which includes the Studio component.

### Features

- **Monaco Editor**: A full-featured editor experience with TypeScript support, including auto-completion and syntax highlighting for Zod.
- **Real-time Conversion**: As you type your Zod schema, the Studio automatically calls `extractMongooseDef` and displays the resulting POJO.
- **Type Exploration**: Hover over Zod methods to see documentation and inferred types.
- **Validation Testing**: Verify that your Zod schemas correctly translate complex validations like `.regex()`, `.min()`, or `.transform()`.

## Why use Studio?

The Studio is ideal for:
1. **Designing complex schemas**: Visualize how nested objects, arrays, and unions are mapped to Mongoose.
2. **Debugging transformations**: If a Mongoose schema doesn't behave as expected, test the Zod conversion in isolation.
3. **Learning the API**: Discover how different Zod types and `withMongoose` metadata options affect the final Mongoose definition.
