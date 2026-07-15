# Base Node.js image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy all project files
COPY . .

# Set Next.js telemetry to disabled
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time placeholders. `next build` collects page data, which imports
# modules that throw when these are unset (lib/encryption.ts, lib/csrf.ts,
# lib/auth.ts, lib/db/client.ts) — the build fails without them.
#
# These are NOT secrets and are never used at runtime: this is the `builder`
# stage, and the `runner` stage below starts from a clean base, so none of them
# reach the final image. Real values are injected by docker-compose at runtime.
# None are NEXT_PUBLIC_*, so nothing here is inlined into the client bundle.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
ENV ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
ENV CSRF_SECRET=build-time-placeholder
ENV BETTER_AUTH_SECRET=build-time-placeholder
ENV MINIO_ENDPOINT=localhost
ENV MINIO_PORT=9000
ENV MINIO_USE_SSL=false
ENV MINIO_ACCESS_KEY=build
ENV MINIO_SECRET_KEY=build-time-placeholder
ENV MINIO_BUCKET=chat-attachments
ENV MINIO_PUBLIC_URL=http://localhost:9000

# Build the application
RUN npm run build

# Verify standalone build was created
RUN ls -la .next/ && \
    if [ ! -d ".next/standalone" ]; then \
      echo "ERROR: .next/standalone directory not found. Make sure output: 'standalone' is set in next.config.ts"; \
      exit 1; \
    fi

# One-shot migration runner, used by the `migrate` service in docker-compose.
# Kept separate from `runner` so the app image stays free of drizzle-kit and the
# migration SQL. Needs node_modules (drizzle-kit is a devDependency), the config,
# and lib/db (schema + migrations).
FROM base AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY lib/db ./lib/db
CMD ["npx", "drizzle-kit", "migrate"]

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Set environment variable for port
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Health check to verify container is running properly
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
