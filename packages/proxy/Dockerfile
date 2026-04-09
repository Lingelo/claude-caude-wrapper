FROM node:22-slim AS builder

WORKDIR /app

# Copy workspace root
COPY package.json tsconfig.base.json ./
COPY packages/proxy/package.json packages/proxy/
COPY packages/cli/package.json packages/cli/

RUN npm install

# Copy source
COPY packages/proxy/ packages/proxy/

# Build
RUN npm run build -w packages/proxy

FROM node:22-slim

WORKDIR /app

# Install production deps only
COPY package.json ./
COPY packages/proxy/package.json packages/proxy/
COPY packages/cli/package.json packages/cli/

RUN npm install --omit=dev

# Copy built files and schema
COPY --from=builder /app/packages/proxy/dist packages/proxy/dist
COPY packages/proxy/src/db/schema.sql packages/proxy/dist/db/

# Create data directory
RUN mkdir -p /app/data

ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/usage.db

EXPOSE 8080

CMD ["node", "packages/proxy/dist/index.js"]
