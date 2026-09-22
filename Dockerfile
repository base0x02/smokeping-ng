# --- Stage 1: build frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: build backend ---
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# --- Stage 3: runtime ---
FROM node:20-alpine AS runtime
RUN apk add --no-cache fping
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-build /app/backend/dist ./dist
COPY backend/drizzle ./drizzle
COPY --from=frontend-build /app/frontend/dist ./dist/public

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
