# Deployment Guide

This guide explains how to manage releases and deploy the `zod-mongoose` family of packages to npm using GitHub Actions and Changesets.

## Package Structure

- `@nullix/zod-mongoose`: Core package.
- `@nullix/zod-mongoose-studio`: Studio component and Nuxt layer.

Both packages are kept in sync regarding their version numbers.

## Release Process

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

### 1. Create a Changeset

When you make a change that requires a new version, run the following command in the root of the repository:

```bash
pnpm changeset
```

Follow the interactive prompts:
1. Select which packages should be versioned (usually both).
2. Choose the version type (patch, minor, or major).
3. Provide a brief description of the changes for the changelog.

This will create a new markdown file in the `.changeset` directory. Commit this file to your branch.

### 2. Merge to Main

Once your PR is reviewed and merged into the `main` branch, the **Release** GitHub Action will trigger.

### 3. Automated Release Pull Request

The GitHub Action will detect new changeset files and automatically create (or update) a "Version Packages" Pull Request. This PR:
- Bumps the versions in `package.json` files.
- Updates the `CHANGELOG.md` files.
- Removes the consumed changeset files.

### 4. Publish to npm

To trigger the actual publication to npm:
1. Review the "Version Packages" PR.
2. Merge the "Version Packages" PR into `main`.

The GitHub Action will run again, but this time it will see that there are no new changesets and that versions have been bumped. It will then:
1. Run tests (`pnpm run test`).
2. Build the packages (`pnpm run build`).
3. Publish both packages to npm (`pnpm release`).
4. Create a GitHub Release with the changelog.

## Manual Troubleshooting

### Manual Publish

If you ever need to publish manually (not recommended), ensure you have an `NPM_TOKEN` and run:

```bash
pnpm build
pnpm changeset publish
```

### CI/CD Configuration

The release workflow is defined in `.github/workflows/release.yml`. It requires the following secrets to be set in the GitHub repository:
- `NPM_TOKEN`: A Granular Access Token or Automation Token from npmjs.com with publish permissions for the `@nullix` scope.
- `GITHUB_TOKEN`: Provided automatically by GitHub Actions (used for creating PRs and Releases).

## Versioning Policy

- **Patch**: Bug fixes, non-breaking internal changes.
- **Minor**: New features, non-breaking API additions.
- **Major**: Breaking changes, significant API overhauls.

Since we use a "fixed" versioning mode, both core and studio packages will always share the same version number.
