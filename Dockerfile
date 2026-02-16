FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN pnpm prisma:generate
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build /app/.next /app/.next
COPY --from=build /app/public /app/public
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/next.config.mjs /app/next.config.mjs
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/scripts /app/scripts
COPY --from=build /app/lib /app/lib
COPY --from=build /app/app /app/app
COPY --from=build /app/components /app/components
COPY --from=build /app/middleware.ts /app/middleware.ts
COPY --from=build /app/postcss.config.cjs /app/postcss.config.cjs
COPY --from=build /app/tailwind.config.ts /app/tailwind.config.ts
COPY --from=build /app/tsconfig.json /app/tsconfig.json
COPY --from=deps /app/node_modules /app/node_modules
COPY scripts/docker-start.sh /app/docker-start.sh

RUN chmod +x /app/docker-start.sh

EXPOSE 3000
CMD ["/app/docker-start.sh"]
