# syntax=docker/dockerfile:1

# This Dockerfile is intended to be built from the monorepo root:
#   cd cumprido
#   docker build -f apps/server/Dockerfile -t cumprido-server:latest .

FROM node:20-slim AS deps
WORKDIR /repo

# Prisma needs OpenSSL available both at generate-time and runtime
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pnpm via Corepack
RUN corepack enable

# Workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Workspace packages (if referenced)
COPY packages ./packages

# Server + required runtime assets
COPY apps/server ./apps/server

# Install all deps needed to build the server
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm -C apps/server db:generate
RUN pnpm -C apps/server build

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /repo

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

# Workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server

# Install production deps for the server (workspace-aware)
RUN pnpm --filter server... install --prod --frozen-lockfile

# Ensure Prisma Client is generated from the server schema
RUN pnpm -C apps/server db:generate

# Bring compiled output across
COPY --from=build /repo/apps/server/dist ./apps/server/dist

# Ensure uploads directory exists (served at /uploads/)
RUN mkdir -p /repo/apps/server/uploads
VOLUME ["/repo/apps/server/uploads"]

WORKDIR /repo/apps/server
EXPOSE 3001

# Nest build outputs dist/src/main.js in this repo
CMD ["node", "dist/src/main.js"]
