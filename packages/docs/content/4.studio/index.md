---
title: Playground and Studio
description: Try Zod-to-Mongoose conversion in the browser or embed the Studio in your application.
---

# Playground and Studio

The [online playground](/playground) runs Studio in your browser. Paste a Zod schema to inspect its Mongoose definition before changing your app. It needs no local setup or database connection.

## Try the playground

Open the [interactive playground](/playground), edit the example schema, and compare the generated definition. It is useful for checking nested objects, IDs, and conversion options. You can share a playground URL when discussing a schema with a teammate.

The playground shows conversion output. To check actual document behavior, use the runnable scripts in [Nested Object IDs](/guides/nested-object-ids) and [Reusing Object Schemas](/guides/reusing-object-schemas).

## Use Studio locally

Studio is also a separate package for applications that want an embedded schema editor:

```bash [pnpm]
pnpm add @nullix/zod-mongoose-studio
```

Inside this repository, start the playground with `pnpm run dev` from the root. The [Studio package README](https://github.com/Harm-Nullix/zod-mongoose/tree/main/packages/studio) covers component integration.
