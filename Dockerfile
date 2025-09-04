# syntax=docker/dockerfile:1

############################
# 1) Base
############################
FROM node:22-alpine AS base
WORKDIR /app
ENV CI=1
COPY package*.json ./

############################
# 2) Production deps
############################
FROM base AS deps-prod
RUN npm ci --omit=dev

############################
# 3) Build deps
############################
FROM base AS deps-build
RUN npm ci

############################
# 4) Compile TypeScript
############################
FROM deps-build AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

############################
# 5) Runtime image
############################
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# prod deps
COPY --from=deps-prod /app/node_modules ./node_modules

# compiled app
COPY --from=build /app/dist ./dist

# config + migrations for sequelize CLI
COPY package*.json ./
COPY sequelize.config.cjs ./
COPY migrations ./migrations

EXPOSE 3000
CMD ["node", "dist/main.js"]
