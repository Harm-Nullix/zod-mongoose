# @nullix/zod-mongoose-docs

The documentation site for `zod-mongoose`, powered by [Nuxt UI Pro](https://ui.nuxt.com/pro) and [Nuxt Content](https://content.nuxt.com).

## Features

- **Nuxt 4 Ready**: Built using the latest Nuxt features and directory structure.
- **Interactive Playground**: Integrated `zod-mongoose-studio` for real-time Zod-to-Mongoose schema conversion.
- **Comprehensive API Docs**: Auto-generated and manually curated documentation for all core functions and specialized helpers.
- **Nuxt UI Pro**: Styled with the official Nuxt documentation template.

## Development

### Setup

Install the dependencies from the project root:

```bash
pnpm install
```

### Local Development

Start the development server with the documentation:

```bash
pnpm --filter docs dev
```

The documentation will be available at `http://localhost:3000`.

### Build

Build the documentation for production:

```bash
pnpm --filter docs build
```

### Preview

Locally preview the production build:

```bash
pnpm --filter docs preview
```

## Structure

- `app/`: Contains the Nuxt application code, including custom pages and components.
- `content/`: The markdown source for the documentation.
- `public/`: Static assets like logos and images.
- `nuxt.config.ts`: Configuration for Nuxt and its modules.
- `app.config.ts`: UI and navigation configuration.

## Contribution

Feel free to open a Pull Request if you'd like to improve the documentation. For major changes, please open an issue first to discuss what you would like to change.

---

[Main README](../../README.md) | [zod-mongoose-studio](../studio/README.md)
