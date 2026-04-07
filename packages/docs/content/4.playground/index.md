---
title: Online Playground
description: Try zod-mongoose directly in the online playground.
---

# Online Playground

The **zod-mongoose Playground** is an online interface powered by the [Studio](/studio), allowing you to experiment with schema transformations directly in your browser without any local setup.

## Getting Started

You can access the playground at [/playground](/playground).

::u-button
---
to: /playground
size: lg
trailingIcon: i-lucide-external-link
---
Open Playground
::

### What can you do in the playground?

1. **Write Zod Schemas**: Use the Monaco editor to define Zod schemas with full TypeScript support.
2. **Instant Preview**: See the Mongoose schema definition update in real-time as you modify your Zod schema.
3. **Share Examples**: Copy a URL with your current schema encoded to share it with colleagues or for issue reporting.
4. **Learn the API**: Hover over Zod methods and `withMongoose` options to see documentation and usage tips.

## How it works

The playground uses the same underlying logic as the core `@nullix/zod-mongoose` package. It runs entirely in your browser using:

- **Nuxt**: For the framework and UI.
- **Monaco Editor**: For the IDE-like experience.
- **Web Workers**: To handle the TypeScript compilation and Zod-to-Mongoose conversion without blocking the main thread.

## Why use the Online Playground?

- **Zero-setup experimentation**: Test a complex schema before adding `zod-mongoose` to your project.
- **Interactive documentation**: See for yourself how different Zod validators are mapped to Mongoose options.
- **Quick prototyping**: Rapidly iterate on a data model and share it for feedback.
- **Issue reporting**: When reporting a bug or requesting a feature, you can provide a playground link that demonstrates the current behavior.
