#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate

echo "Setup complete. Run 'npm run dev' to start."
