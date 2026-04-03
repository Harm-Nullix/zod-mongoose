# @nullix/zod-mongoose

This is a monorepo containing the `@nullix/zod-mongoose` ecosystem, a collection of tools for integrating [Zod](https://github.com/colinhacks/zod) with [Mongoose](https://github.com/Automattic/mongoose).

## Packages

- **[@nullix/zod-mongoose](./packages/core)**: The core library for converting Zod schemas to Mongoose schemas.
- **[@nullix/zod-mongoose-studio](./packages/studio)**: A Monaco-powered TypeScript playground for testing and visualizing Zod-to-Mongoose transformations.
- **[Playground](./playground)**: A Nuxt-based integration test and showcase environment.

---

## zod-mongoose (Core)

`@nullix/zod-mongoose` allows you to author Mongoose schemas using Zod, providing a single source of truth for your data models with full TypeScript type safety.

### Quick Start

```bash
pnpm add @nullix/zod-mongoose zod/v4
```

```typescript
import { z } from 'zod/v4';
import { toMongooseSchema } from '@nullix/zod-mongoose';

const UserZodSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  age: z.number().optional(),
});

// Convert to Mongoose Schema
const UserSchema = toMongooseSchema(UserZodSchema);

// Use with Mongoose
const UserModel = mongoose.model('User', UserSchema);
```

### Key Features

- **Zod v4 Support**: Optimized for the latest Zod features and registry.
- **Native Discriminators**: Automatically maps `z.discriminatedUnion` to native Mongoose discriminators.
- **XOR Support**: Implements mutual exclusivity validation for non-inclusive unions.
- **Isomorphic**: Use the same schemas on the frontend and backend with `setFrontendMode`.
- **Nuxt 4 Ready**: Built-in support for Nuxt and Nitro environments.

For more details, see the [Core Package README](./packages/core/README.md).

---

## Development

This repository uses `pnpm` workspaces.

### Installation

```bash
pnpm install
```

### Scripts

- `pnpm run build`: Build all packages.
- `pnpm run test`: Run tests across all packages.
- `pnpm run lint`: Lint the codebase.
- `pnpm run dev`: Start the playground in development mode.

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our development process and how to contribute.

## License

[MIT](./packages/core/LICENSE.md)