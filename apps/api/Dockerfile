# ─── Base: Node.js + pnpm ────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# ─── Deps: instala todas as dependências do workspace ────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ─── Development: hot reload via nest start --watch ──────────────────────────
# apps/api/src é montado como volume pelo docker-compose em runtime.
FROM deps AS development
COPY packages/shared ./packages/shared
COPY apps/api/tsconfig.json \
     apps/api/tsconfig.build.json \
     apps/api/nest-cli.json \
     ./apps/api/
EXPOSE 3001
CMD ["pnpm", "--filter", "@saas-platform/api", "dev"]

# ─── Builder: compila shared e api para produção ─────────────────────────────
FROM deps AS builder
COPY . .
RUN pnpm --filter @saas-platform/shared build \
 && pnpm --filter @saas-platform/api build \
 && pnpm --filter @saas-platform/api deploy --prod /standalone \
 # pnpm deploy respeita .gitignore, então dist/ pode ter sido excluído — copia explicitamente.
 && cp -r apps/api/dist /standalone/dist \
 && cp -r packages/shared/dist /standalone/node_modules/@saas-platform/shared/dist

# ─── Production: imagem mínima sem fonte nem devDependencies ─────────────────
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /standalone .
EXPOSE 3001
# Roda como usuário não-root
USER node
CMD ["node", "dist/main.js"]
