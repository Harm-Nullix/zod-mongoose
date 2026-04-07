![Logo](./packages/docs/public/zodmongoose.svg)

[![Release](https://github.com/harm-nullix/zod-mongoose/actions/workflows/release.yml/badge.svg)](https://github.com/harm-nullix/zod-mongoose/actions/workflows/release.yml)
[![NPM Version](https://img.shields.io/npm/v/@nullix/zod-mongoose.svg)](https://www.npmjs.com/package/@nullix/zod-mongoose)
[![License](https://img.shields.io/npm/l/@nullix/zod-mongoose.svg)](https://github.com/harm-nullix/zod-mongoose/blob/main/packages/core/LICENSE.md)

# zod-mongoose

Seamlessly integrate [Zod](https://github.com/colinhacks/zod) with [Mongoose](https://github.com/Automattic/mongoose) for full TypeScript type safety. Define your schemas once with Zod and automatically generate Mongoose schemas.

[**Explore the Documentation »**](https://zodmongoose.com)

[Getting Started](https://zodmongoose.com/getting-started) | [API Reference](https://zodmongoose.com/api) | [Online Playground](https://zodmongoose.com/playground)

---

## Why zod-mongoose?

In modern TypeScript applications, you often find yourself defining the same schema twice: once for runtime validation (Zod) and once for your database (Mongoose). `zod-mongoose` eliminates this duplication by providing a single source of truth.

- **Type Safety**: Full TypeScript support with inference from your Zod schemas.
- **Automatic Mapping**: Zod validators like `.min()`, `.max()`, and `.regex()` are directly converted to Mongoose options.
- **Native Discriminators**: Automatically maps `z.discriminatedUnion` to native Mongoose discriminators.
- **Advanced Types**: Built-in support for `ObjectId`, `Decimal128`, `BigInt`, and more.
- **Isomorphic**: Share schemas between frontend and backend with `setFrontendMode`.

---

## Quick Start

### 1. Install

```bash
pnpm add @nullix/zod-mongoose zod/v4 mongoose
```

### 2. Define and Convert

```typescript
import { z } from 'zod/v4';
import { toMongooseSchema } from '@nullix/zod-mongoose';
import mongoose from 'mongoose';

// Define your Zod schema
const UserZodSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  age: z.number().min(18).optional(),
  role: z.enum(['user', 'admin']).default('user'),
});

// Convert to Mongoose Schema
const UserSchema = toMongooseSchema(UserZodSchema);

// Create your Model
export const UserModel = mongoose.model('User', UserSchema);
```

### 3. Usage with Type Inference

```typescript
// Infer the TypeScript type from the Zod schema
type User = z.infer<typeof UserZodSchema>;

async function createUser(data: User) {
  const user = await UserModel.create(data);
  return user;
}
```

---

## Ecosystem Packages

- **[@nullix/zod-mongoose](./packages/core)**: The core library for schema conversion and type safety.
- **[@nullix/zod-mongoose-studio](./packages/studio)**: A Monaco-powered component to visualize transformations.
- **[Documentation Site](./packages/docs)**: Built with Nuxt UI Pro and Nuxt Content.

---

## Development

This repository is a monorepo managed with `pnpm` workspaces.

### Local Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm run test

# Start the playground/docs in development
pnpm run dev
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for our development process.

## License

[MIT](./packages/core/LICENSE.md) © [Harm-Nullix](https://github.com/Harm-Nullix)