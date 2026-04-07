---
seo:
  title: zod-mongoose
  description: Seamlessly integrate Zod with Mongoose for full type safety.
---

:::u-page-hero{class="dark:bg-gradient-to-b from-neutral-900 to-neutral-950"}
---
orientation: horizontal
---
#top
:hero-background

#title
Define [Mongoose]{.text-secondary} schemas with [Zod]{.text-primary}.

#description
`zod-mongoose` provides a single source of truth for your data models with full TypeScript type safety. No more duplicate definitions.

#links
  :::u-button
  ---
  to: /getting-started
  size: xl
  trailing-icon: i-lucide-arrow-right
  ---
  Get Started
  :::

  :::u-button
  ---
  icon: i-simple-icons-github
  color: neutral
  variant: outline
  size: xl
  to: https://github.com/Harm-Nullix/zod-mongoose
  target: _blank
  ---
  GitHub
  :::

#default
  :::prose-pre
  ---
  code: |
    import { z } from 'zod/v4';
    import { toMongooseSchema } from '@nullix/zod-mongoose';

    const UserZodSchema = z.object({
      username: z.string().min(3),
      email: z.string().email(),
    });

    const UserSchema = toMongooseSchema(UserZodSchema);
  filename: example.ts
  ---

  ```ts [example.ts]
  import { z } from 'zod/v4';
  import { toMongooseSchema } from '@nullix/zod-mongoose';

  const UserZodSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
  });

  const UserSchema = toMongooseSchema(UserZodSchema);
  ```
  :::
:::

:::u-page-section{class="dark:bg-neutral-950"}
#title
Powerful features for developers

#features
  :::u-page-feature
  ---
  icon: i-lucide-shield-check
  ---
  #title
  Type Safety

  #description
  Enjoy full TypeScript support and prevent inconsistencies between your document interfaces and Mongoose schemas.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-zap
  ---
  #title
  Automatic Mapping

  #description
  Zod validators like `.min()`, `.max()`, and `.regex()` are directly converted to the appropriate Mongoose SchemaType options.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layers
  ---
  #title
  Native Discriminators

  #description
  Support for `z.discriminatedUnion` is automatically translated into robust Mongoose discriminators for polymorphic data.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-monitor
  ---
  #title
  Studio & Playground

  #description
  Test and visualize your schema transformations in real-time with the included Studio and online playground.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-globe
  ---
  #title
  Isomorphic

  #description
  Use the same schemas on both the frontend and the backend thanks to the built-in frontend mode.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-box
  ---
  #title
  Nuxt 4 Ready

  #description
  Seamless integration with Nuxt 4 and Nitro for validating request bodies using Zod schemas.
  :::
:::

:::u-page-section{class="dark:bg-gradient-to-b from-neutral-950 to-neutral-900"}
  :::u-page-c-t-a
  ---
  links:
    - label: Start now
      to: '/getting-started'
      trailingIcon: i-lucide-arrow-right
    - label: View on GitHub
      to: 'https://github.com/Harm-Nullix/zod-mongoose'
      target: _blank
      variant: subtle
      icon: i-simple-icons-github
  title: Ready to enhance your Mongoose workflow?
  description: Join developers who choose better type safety and less duplicate code.
  class: dark:bg-neutral-950
  ---

  :stars-bg
  :::
:::
