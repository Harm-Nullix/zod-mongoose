![Logo](./public/zodmongoose.svg)

[![Release](https://github.com/harm-nullix/zod-mongoose/actions/workflows/release.yml/badge.svg)](https://github.com/harm-nullix/zod-mongoose/actions/workflows/release.yml)
[![NPM Version](https://img.shields.io/npm/v/@nullix/zod-mongoose.svg)](https://www.npmjs.com/package/@nullix/zod-mongoose-studio)
[![License](https://img.shields.io/npm/l/@nullix/zod-mongoose.svg)](https://github.com/harm-nullix/zod-mongoose/blob/main/packages/core/LICENSE.md)


# @nullix/zod-mongoose-studio

A Monaco-powered TypeScript playground for [@nullix/zod-mongoose](https://github.com/harm-nullix/zod-mongoose). 

The Studio provides a powerful web-integrated interface to experiment with Zod-to-Mongoose transformations. It supports local development via a CLI with full filesystem access and a sandboxed mode for documentation and live demos.

## Goal

Create a CLI tool and web-integrated "Studio" that provides:
- A Monaco-powered TypeScript editor for Zod schemas.
- Real-time transformation to Mongoose schema definitions and POJOs.
- **Local Mode**: Runs via `npx` with full filesystem bridge for IntelliSense in your project.
- **Docs Mode**: A secure, sandboxed environment for embedding in documentation or static deployments.

## Technical Stack

- **Framework**: Nuxt 4 (Vue 3)
- **UI**: [Nuxt UI](https://ui.nuxt.com/) (Tailwind CSS)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Server**: Nitro (Nuxt built-in server)
- **CLI**: Commander.js
- **Logic**: [@nullix/zod-mongoose](https://www.npmjs.com/package/@nullix/zod-mongoose) for the transformation engine.

## Usage

### 🚀 CLI (Local Mode)

Run the studio locally in any project to test your schemas with your actual local types.

```shell
npx @nullix/zod-mongoose-studio
```

Optional parameters:
```shell
# Custom port
npx @nullix/zod-mongoose-studio --port 30045

# Disable local filesystem access
npx @nullix/zod-mongoose-studio --no-fs
```

In Local Mode, the Studio provides a bridge to your local files using `ts-morph`, allowing Monaco to provide IntelliSense for your project's custom types.

### 🧩 Nuxt Integration (Docs Mode)

To embed the Studio into your own documentation or Nuxt application:

1. Install the package:
```shell
pnpm install @nullix/zod-mongoose-studio
```

2. Extend your `nuxt.config.ts`:
```ts
export default defineNuxtConfig({
  extends: ['@nullix/zod-mongoose-studio'],
  
  // Turn on docs mode securely
  runtimeConfig: {
    public: {
      isDocsMode: true,
      isLocalMode: false
    }
  }
})
```

3. Use the component in your pages:
```vue
<template>
  <UContainer>
    <h1 class="text-2xl font-bold my-4">Try it live!</h1>
    
    <!-- Automatically connects to the injected /api/parse route -->
    <ZodMongooseStudio class="h-[600px] border rounded-lg shadow-sm" />
  </UContainer>
</template>
```

## Features & Configuration

### Transformation Engine (`/api/parse`)

The core logic executes Zod schemas in a controlled environment. It automatically injects the necessary imports for `zod/v4` and `@nullix/zod-mongoose`:

```ts
import * as zod from 'zod/v4';
const z = zod.z;
import { toMongooseScheme, extractMongooseDefinition } from '@nullix/zod-mongoose';
```

### Filesystem Bridge (`/api/resolve`)

Available only in **Local Mode** (`LOCAL_MODE=true`). It uses Node's `fs` or `ts-morph` to resolve local files based on your current working directory, providing high-quality IntelliSense for your actual project files inside the Monaco editor.

### Sandboxing & Security

When running in **Docs Mode** (`DOCS_MODE=true`), several security layers are enforced:

- **Isolated Execution**: Code transformations occur in a virtual machine context (using `isolated-vm` or equivalent workers) to prevent access to the host `process.env`, `window`, or `document`.
- **Disabled Resolvers**: The `/api/resolve` endpoint is completely disabled.
- **Rate Limiting**: Built-in Nitro middleware tracks IP addresses and limits requests (default: 2 per second) to prevent abuse.
- **UI Hardening**: Elements related to the local filesystem are automatically hidden.

## Project Structure

```text
@nullix/studio
├── bin/                # CLI entry point (npx wrapper)
├── server/
│   ├── api/
│   │   ├── parse.post.ts    # Transform logic (Zod -> Mongoose)
│   │   └── resolve.get.ts  # FS bridge (IntelliSense resolver)
│   └── middleware/
│       └── security.ts      # Rate limiting & sandbox enforcement
├── components/
│   ├── StudioEditor.vue     # Monaco wrapper for input
│   └── StudioOutput.vue     # Monaco wrapper for read-only output
├── pages/
│   └── index.vue            # Main UI (Split-pane view)
└── nuxt.config.ts           # Layer configuration
```

## Contributing

Please refer to the monorepo root for development and contribution guidelines.

## License

MIT