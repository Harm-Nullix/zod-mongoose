# Contributing to @nullix/zod-mongoose-family

Thank you for your interest in contributing to the `@nullix/zod-mongoose` project! This document outlines our development process and guidelines for contributions.

## Project Structure

This repository is a monorepo managed with `pnpm` workspaces.

- `packages/core`: The core transformation engine.
- `packages/studio`: A Monaco-powered TypeScript playground for testing and visualizing transformations.
- `playground`: A Nuxt-based integration testing and showcase environment.

## Getting Started

### Prerequisites

- Node.js (>= 24)
- pnpm (>= 9.11.0)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Harm-Nullix/zod-mongoose.git
   cd zod-mongoose
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the project:
   ```bash
   pnpm run build
   ```

## Development Workflow

### Scripts

From the root of the repository, you can run:

- `pnpm run dev`: Starts the Nuxt playground (located in `/playground`).
- `pnpm run test`: Runs the full test suite across all packages.
- `pnpm run lint`: Checks the codebase for linting and formatting issues.
- `pnpm run build`: Builds all packages for distribution.

### Testing

We use `vitest` (or `bun test` in some environments) for testing.

- For unit tests in the core package:
  ```bash
  cd packages/core
  pnpm test
  ```
- For playground integration tests:
  ```bash
  pnpm --filter "@nullix/zod-mongoose-playground" run test
  ```

When adding new features or fixing bugs, please ensure that you include corresponding tests.

## Contribution Guidelines

### Branching and Pull Requests

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feat/my-new-feature
   # or
   git checkout -b fix/my-bug-fix
   ```
2. Commit your changes with descriptive commit messages.
3. Push your branch to your fork and create a Pull Request.

### Code Style

- We use `eslint` and `prettier` to maintain code quality and consistency.
- Please run `pnpm run lint` before submitting a Pull Request.

### Commit Guidelines

- Use clear and descriptive commit messages.
- If you are using an AI assistant like Junie, please add her as a co-author:
  ```bash
  git commit -m "my message" --trailer "Co-authored-by: Junie <junie@jetbrains.com>"
  ```

## Issues and Feedback

If you find a bug or have a feature request, please open an issue on GitHub. Before opening a new issue, please check if a similar issue already exists.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./packages/core/LICENSE.md).