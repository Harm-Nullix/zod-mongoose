# @nullix/zod-mongoose Playground

This is a playground for testing and demonstrating `@nullix/zod-mongoose` with **Nuxt 4**, **Zod v4**, and **Mongoose 9**.

## Features

- **Nuxt 4**: Modern full-stack Vue framework.
- **Nuxt UI 4**: Beautiful and accessible UI components with built-in Zod validation.
- **Mongoose 9**: MongoDB object modeling.
- **In-memory MongoDB**: Automatically starts a temporary MongoDB instance for development.
- **Shared Schemas**: Zod schemas defined in `shared/` are used by both the frontend and backend.

## Setup

Ensure you have [pnpm](https://pnpm.io/) installed, then install dependencies:

```bash
pnpm install
```

## Development

Start the development server:

```bash
pnpm dev
```

The playground will be available at `http://localhost:3000`.

### Debugging

To debug the Nitro server (backend) with Node.js inspector:

```bash
pnpm debug
```

This starts the server with `NITRO_INSPECT=0.0.0.0:34003`, allowing you to attach a debugger to port `34003`.

## Architecture

### 1. Shared Schemas (`shared/schemas.ts`)
We define our Zod schemas here. These are used for:
- **Frontend Validation**: Nuxt UI forms use these schemas to validate user input before sending it to the server.
- **Backend Validation**: Nitro server routes use these schemas to validate request bodies.
- **Database Modeling**: Mongoose models are generated directly from these Zod schemas.

### 2. Mongoose Models (`server/models/index.ts`)
The Zod schemas are converted to Mongoose models using `toMongooseSchema`. This happens strictly on the server side.

### 3. API Routes (`server/api/`)
Nitro API routes handle post creation and retrieval. They use the shared schemas for type-safe requests and responses.

## Key Patterns

### `_id` Handling
In this playground, we follow the recommended pattern for `_id`:
- **Base Schema**: Includes `_id: zObjectId()` for full type safety when reading documents.
- **Input Schema**: Uses `BaseSchema.omit({ _id: true })` for creation (POST) requests to ensure Mongoose handles ID generation.

### Populated Types
We use specialized type helpers in `shared/schemas.ts` to represent "Populated" versions of our models, ensuring that fields like `author` are correctly typed as objects instead of just IDs when fetched from the API.