# syntax=docker/dockerfile:1

############################
# 1) Base with lockfiles
############################
FROM node:22-alpine AS base
WORKDIR /app
ENV CI=1
# keep caching fast by copying only lockfiles first
COPY package*.json ./

############################
# 2) Prod deps (runtime layer)
############################
FROM base AS deps-prod
RUN npm ci --omit=dev

############################
# 3) Full deps for build (TS)
############################
FROM base AS deps-build
RUN npm ci

############################
# 4) Build TypeScript
############################
FROM deps-build AS build
# copy just what the compiler needs
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

############################
# 5) Final runtime image
############################
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# runtime node_modules (prod-only)
COPY --from=deps-prod /app/node_modules ./node_modules

# compiled JS
COPY --from=build /app/dist ./dist

# 👇 keep package.json present so `npm run migrate` works in .aptible.yml
COPY package*.json ./

# App listens on $PORT (Aptible injects it)
EXPOSE 3000
CMD ["node", "dist/main.js"]
