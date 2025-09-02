# syntax=docker/dockerfile:1

############################
# 1) Base
############################
FROM node:22-alpine AS base
WORKDIR /app/backend
ENV CI=1
COPY backend/package*.json ./

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
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

############################
# 5) Runtime image
############################
FROM node:22-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production

# prod deps
COPY --from=deps-prod /app/backend/node_modules ./node_modules

# compiled app
COPY --from=build /app/backend/dist ./dist

# config + migrations for sequelize CLI
COPY backend/package*.json ./
COPY backend/.sequelizerc ./
COPY backend/sequelize.config.cjs ./
COPY backend/migrations ./migrations
# COPY backend/models ./models
# COPY backend/seeders ./seeders

EXPOSE 3000
CMD ["node", "dist/main.js"]
