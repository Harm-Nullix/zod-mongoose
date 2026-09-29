<div align="center">
  <img src="https://raw.githubusercontent.com/Harm-Nullix/zod-mongoose/HEAD/logo.svg" width="200" alt="Logo">
</div>
<div align="center">

[![Release](https://github.com/Harm-Nullix/zod-mongoose/actions/workflows/release.yml/badge.svg)](https://github.com/Harm-Nullix/zod-mongoose/actions/workflows/release.yml)
[![NPM Version](https://img.shields.io/npm/v/@nullix/zod-mongoose-studio.svg)](https://www.npmjs.com/package/@nullix/zod-mongoose-studio)
[![NPM Downloads](https://img.shields.io/npm/dm/@nullix/zod-mongoose-studio.svg)](https://www.npmjs.com/package/@nullix/zod-mongoose-studio)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/node/v/@nullix/zod-mongoose-studio.svg)](https://www.npmjs.com/package/@nullix/zod-mongoose-studio)
[![License](https://img.shields.io/npm/l/@nullix/zod-mongoose.svg)](https://github.com/Harm-Nullix/zod-mongoose/blob/main/packages/studio/LICENSE.md)

</div>


# @nullix/zod-mongoose-studio

A Monaco-powered TypeScript playground for [@nullix/zod-mongoose](https://github.com/Harm-Nullix/zod-mongoose). 

The Studio provides a web-integrated interface to experiment with Zod validation and Zod-to-Mongoose transformations. It supports local development via a CLI and an embedded documentation mode.

## Goal

Create a CLI tool and web-integrated "Studio" that provides:
- A Monaco-powered TypeScript editor for Zod schemas and a separate JSON data editor.
- Parsed Zod output or field-level validation issues next to Mongoose conversion output.
- Schema discovery, valid example data, and Run shortcuts.
- **Local Mode**: Runs via `npx` with full filesystem bridge for IntelliSense in your project.
- **Docs Mode**: An embeddable playground that sends Run requests to a separate container runner through a Unix socket.

## Studio workflow

Define one or more Zod schemas in the TypeScript editor. `z` from `zod/v4` and the runtime exports of `@nullix/zod-mongoose` are available without import lines:

```ts
const UserSchema = z.object({
  name: z.string().trim().min(2),
  role: z.enum(['reader', 'admin']).default('reader'),
});
```

Studio discovers top-level schemas automatically. When there are several, choose one from **Active schema**. Existing snippets using explicit imports and `export default` still work.

Use the expand button in any panel header for a full Studio workspace, then press Escape or the button again to restore the grid. The schema code, JSON input, and selected schema survive reloads in the same browser tab through `sessionStorage`; they are not saved on the server.

Enter JSON in **Try some data** and select **Run studio**. The validation result shows parsed data, including defaults and transforms, or Zod issues with their paths. Mongoose output remains available under **Definition**, **.obj**, **.tree**, and **.paths**. Use `⌘/Ctrl+S` or `⌘/Ctrl+R` to run while Studio has focus. Local mode also reruns after a short pause when schema code changes.

**Load valid example** generates JSON input and checks it against the selected schema before inserting it. For a custom refinement that cannot be generated automatically, provide a top-level `const exampleInput = { ... }` in the code editor; Studio checks that value too.

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
    
    <!-- Run uses the isolated runner configured on the docs host. -->
    <ZodMongooseStudio class="border rounded-lg shadow-sm" style="--studio-height: 600px" />
  </UContainer>
</template>
```

## Features & Configuration

### Transformation Engine (`/api/parse` locally, `/api/studio/run` in docs)

The runner exposes `z` and the public runtime helpers from `@nullix/zod-mongoose` as editor globals. Explicit imports of `zod/v4`, `@nullix/zod-mongoose`, and `mongoose` are also supported. The API accepts schema code, selected schema name, and JSON input; it returns validation and conversion results separately.

```ts
const UserSchema = z.object({ name: z.string() });
const exampleInput = { name: 'Ada' }; // Optional for custom validation rules
```

### Filesystem Bridge (`/api/resolve`)

Available only in **Local Mode** (`LOCAL_MODE=true`). It uses Node's `fs` or `ts-morph` to resolve local files based on your current working directory, providing high-quality IntelliSense for your actual project files inside the Monaco editor.

### Sandboxing & Security

Node's `vm` is **not a security boundary for untrusted code**. In Docs Mode, `/api/studio/run` forwards requests to a warm container through `STUDIO_RUNNER_SOCKET`; `/api/parse` remains restricted to the local CLI. Without the socket, the docs route returns 503. The docs process never evaluates visitor code. The runner container has no network and is read-only with CPU, memory, and process limits in `docker/compose.yaml`. Its small root supervisor accepts requests over the socket and starts a **new process with a fresh, unprivileged UID for every run**. No session retains a worker; at most two requests execute at once and eight wait in the queue. The three-second deadline kills the worker process group. The socket is owned by UID/GID 1000 and cannot be opened by workers. The supervisor needs only CHOWN, SETUID, SETGID and KILL capabilities. This reduces cross-request exposure, but does not make arbitrary code execution risk-free: malicious code could still try to exhaust the runner container or escape a process group. Keep Docker and the VPS patched and retain edge-level rate limits. Do not mount the Docker daemon socket into the docs server or runner.

To run this on a VPS, create `/run/zod-studio` owned by root and group 1000. The root supervisor creates the socket, then gives socket access to UID/GID 1000. Put the docs service in group 1000. Then build and start the runner from the repository root:

```shell
sudo install -d -m 0770 -o 0 -g 1000 /run/zod-studio
docker compose -f packages/studio/docker/compose.yaml up -d --build
```

Set `STUDIO_RUNNER_SOCKET=/run/zod-studio/runner.sock` in the docs server environment, make that socket path visible to its process, and restart the docs server. If the docs server itself runs in a container, mount only `/run/zod-studio`, never the Docker socket. The docs UI enables Run through its Nuxt configuration. The runner has no TCP listener; only the docs server's H3 route is exposed publicly. Keep the existing public rate limit or add an edge-level limit when running multiple docs instances.

After deployment, verify the process boundary from the repository root:

```shell
docker compose -f packages/studio/docker/compose.yaml exec -T --user 1000:1000 studio-runner node - < packages/studio/docker/smoke-test.cjs
```

This checks separate UIDs for concurrent runs, worker denial of socket access, timeout handling, and a successful request after timeout. A fresh process adds startup time to each Run request; no process or server-side session remains allocated between requests.

Local CLI mode continues to run directly, binds to `127.0.0.1`, and checks API hosts and origins. Browser session data stays in `sessionStorage` and is not kept by the runner.

Running `pnpm --filter @nullix/zod-mongoose-studio dev` also uses the local parse endpoint, without Docker. In docs mode the editors remain usable without a runner, but Run reports that the runner is unavailable until the container and `STUDIO_RUNNER_SOCKET` are configured.

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