# syntax=docker/dockerfile:1

# Stage 1: Install production dependencies
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Install build dependencies required by better-sqlite3 (node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Runtime
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3011 \
    PUBLIC_BASE_URL=https://rift.pascadigital.my.id \
    DB_PATH=/app/data/card-quest.sqlite

# Create data directory for SQLite persistence and grant permissions to node user
RUN mkdir -p /app/data && chown -R node:node /app

# Copy dependencies and application files
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server.js db.js game-content.js launcher.js reset.js ./
COPY --chown=node:node public ./public

# Run as non-root user for security
USER node

EXPOSE 3011

VOLUME ["/app/data"]

CMD ["node", "launcher.js"]
