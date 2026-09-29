FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/package.json
COPY packages/studio/package.json packages/studio/package.json
RUN corepack pnpm install --frozen-lockfile --filter @nullix/zod-mongoose-studio...
COPY packages/core packages/core
COPY packages/studio packages/studio
RUN corepack pnpm --filter @nullix/zod-mongoose build
RUN corepack pnpm --filter @nullix/zod-mongoose-studio exec esbuild docker/server.ts docker/worker.ts --bundle --platform=node --target=node24 --format=esm --packages=external --outdir=docker/dist --out-extension:.js=.mjs

FROM node:24-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/package.json
COPY packages/studio/package.json packages/studio/package.json
RUN corepack pnpm install --frozen-lockfile --prod --ignore-scripts --filter @nullix/zod-mongoose-studio...
RUN ln -s ../../studio/node_modules/zod packages/core/node_modules/zod
RUN ln -s ../../studio/node_modules/mongoose packages/core/node_modules/mongoose
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/studio/docker/dist packages/studio/docker/dist
RUN mkdir -p /run/zod-studio
# The supervisor needs only these privileges to assign a fresh UID to each
# request and keep the socket inaccessible to the untrusted child process.
ENV NODE_ENV=production STUDIO_RUNNER_SOCKET=/run/zod-studio/runner.sock
CMD ["node", "packages/studio/docker/dist/server.mjs"]
