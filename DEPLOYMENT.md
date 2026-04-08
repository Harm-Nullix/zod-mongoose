# Deployment Guide

This guide explains how to manage releases and deploy the `@nullix/zod-mongoose` family of packages to npm using GitHub Actions, Changesets, and **Trusted Publishing**.

## Package Structure

- `@nullix/zod-mongoose`: Core package (`packages/zod-mongoose`).
- `@nullix/zod-mongoose-studio`: Studio component (`packages/zod-mongoose-studio`).

Both packages are kept in sync regarding their version numbers (fixed mode).

## Release Process

We use [Changesets](https://github.com/changesets/changesets) to automate versioning and changelogs.

### 1. Create a Changeset

When you make a change that requires a new version, run the following command in the root of the repository on your **feature branch**:

```bash
pnpm changeset
```

Follow the interactive prompts:
1. Select which packages should be versioned (usually both).
2. Choose the version type (**patch**, **minor**, or **major**).
3. Provide a brief description of the changes for the changelog.

This will create a new markdown file in the `.changeset` directory. **Commit and push** this file along with your code changes.

### 2. Merge to Main

Once your PR is reviewed and merged into the `main` branch, the **Release** GitHub Action will trigger.

### 3. Automated "Version Packages" Pull Request

The GitHub Action will detect new changeset files and automatically create (or update) a **"Version Packages"** Pull Request. This PR:
- Bumps the versions in `package.json` files.
- Updates the `CHANGELOG.md` files.
- Removes the consumed changeset files.

### 4. Publish to npm

To trigger the actual publication to npm:
1. Review the "Version Packages" PR on GitHub.
2. **Merge** the "Version Packages" PR into `main`.

The GitHub Action will run again. Since there are no new changesets but versions have been bumped, it will:
1. Run tests (`pnpm run test`).
2. Build the packages (`pnpm run build`).
3. Publish both packages to npm using **Trusted Publishing** (OIDC).
4. Create a GitHub Release with the changelog.

## Repository Configuration

For the automated release process to work correctly, the following settings must be enabled in the GitHub repository:

### 1. Workflow Permissions

1. Go to **Settings** > **Actions** > **General**.
2. Under **Workflow permissions**, ensure **Read and write permissions** is selected.
3. Check **Allow GitHub Actions to create and approve pull requests**.

This allows the `changesets/action` to create the "Version Packages" PR automatically.

### 2. Secrets

1. Go to **Settings** > **Secrets and variables** > **Actions**.
2. Add a new **Repository secret** named `NPM_TOKEN`.
3. Generate a "Granular access token" (or "Classic" with Automation permissions) on [npmjs.com](https://www.npmjs.com/settings/your-username/tokens) and paste it here.

This token is used for the automated publication process.

## Security & Configuration

### Trusted Publishing (OIDC)

We no longer use a manual `NPM_TOKEN` secret. Authentication is handled via **Trusted Publishing**:
- **npm side**: The GitHub repository is added as a "Trusted Publisher" on the `/access` page of the packages on npmjs.com.
- **GitHub side**: The workflow has `id-token: write` permissions to identify itself to npm securely.

### Provenance

Every release is published with `--provenance`. This adds a verified checkmark on npm, proving the code was built directly from this GitHub repository.

## Manual Troubleshooting

### Manual Publish

If you ever need to publish manually (not recommended), ensure you are logged into npm locally and run:

```bash
pnpm build
pnpm changeset publish --provenance
```

> **Note:** Only use manual publishing in emergencies to maintain the integrity of the automated changelogs.

## Versioning Policy

- **Patch**: Bug fixes, non-breaking internal changes.
- **Minor**: New features, non-breaking API additions.
- **Major**: Breaking changes, significant API overhauls.