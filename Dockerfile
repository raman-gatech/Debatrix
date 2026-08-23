FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts ./scripts

USER node
EXPOSE 5000

# Migrations are transactional, advisory-lock protected, and tracked. Running
# them at startup keeps managed platforms without a pre-deploy job (including
# free tiers) from serving an unmigrated database.
CMD ["sh", "-c", "node scripts/migrate.mjs && node dist/index.js"]
