# syntax=docker/dockerfile:1

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
COPY shared/ ../shared/
RUN npm run build

# Stage 2: Build backend
FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY backend/ ./
COPY shared/ ../shared/
RUN npm run build

# Stage 3: Production runtime
FROM node:22-alpine AS production
WORKDIR /app

# Install production dependencies only
COPY backend/package.json backend/package-lock.json ./backend/
RUN --mount=type=cache,target=/root/.npm cd backend && npm ci --omit=dev

# Copy built backend
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/shared ../shared

# Copy built frontend where the backend code expects it
# __dirname = /app/backend/dist/backend/src/, code does ../../frontend/dist
COPY --from=frontend-build /app/frontend/dist ./backend/dist/frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "backend/dist/backend/src/index.js"]
