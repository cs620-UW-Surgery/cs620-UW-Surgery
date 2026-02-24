#!/bin/sh
set -e

echo "Running Prisma migrations..."
pnpm prisma generate
pnpm prisma migrate deploy

if [ "${RUN_INGEST}" = "1" ]; then
  echo "Running ingestion..."
  pnpm ingest
fi

echo "Starting Next.js server..."
pnpm start -p 3000
