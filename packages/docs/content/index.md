---
seo:
  title: zod-mongoose
  description: Create Mongoose schemas from Zod and find clear guides for validation, nested IDs, and references.
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
Create Mongoose schemas from Zod objects. Start with a model you can validate in memory, then use the guides when you need nested objects, references, or shared schemas.

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
    import type { InferDocument } from '@nullix/zod-mongoose';

    const UserZodSchema = z.object({
      username: z.string().min(3),
      email: z.string().email(),
    });

    const UserSchema = toMongooseSchema(UserZodSchema);

    // The stored document type includes Mongoose's generated _id.
    type User = InferDocument<typeof UserZodSchema>;
  filename: example.ts
  ---

  ```ts [example.ts]
  import { z } from 'zod/v4';
  import { toMongooseSchema } from '@nullix/zod-mongoose';
  import type { InferDocument } from '@nullix/zod-mongoose';

  const UserZodSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
  });

  const UserSchema = toMongooseSchema(UserZodSchema);

  // The stored document type includes Mongoose's generated _id.
  type User = InferDocument<typeof UserZodSchema>;
  ```
  :::
:::

:::u-page-section{class="dark:bg-neutral-950"}
#title
What do you need to do?

#features
  :::u-page-feature
  ---
  icon: i-lucide-play
  to: /getting-started
  ---
  #title
  Create a model

  #description
  Install the packages, convert a Zod object, and validate your first Mongoose document.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-scan-search
  to: /guides/validation
  ---
  #title
  Validate documents

  #description
  See which Zod rules run during Mongoose validation and when to parse input yourself.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layers
  to: /guides/nested-object-ids
  ---
  #title
  Control nested IDs

  #description
  Keep or remove `_id` on embedded objects, including schemas imported from other files.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-link
  to: /guides/references-and-population
  ---
  #title
  Reference another model

  #description
  Define an ObjectId reference and validate populated or unpopulated data.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-files
  to: /guides/reusing-object-schemas
  ---
  #title
  Reuse schemas across files

  #description
  Share a Zod object while choosing different Mongoose options at each use.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-monitor
  to: /playground
  ---
  #title
  Try the playground

  #description
  Inspect the generated Mongoose schema before adding it to your project.
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
  title: Ready to build a model?
  description: Follow a small example from installation to validation, then connect to MongoDB when you need to save.
  class: dark:bg-neutral-950
  ---

  :stars-bg
  :::
:::
