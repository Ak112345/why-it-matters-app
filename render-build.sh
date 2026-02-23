#!/usr/bin/env bash
set -e

# Install pnpm if not present
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi

pnpm install
pnpm build

# Optional: Add any custom build steps below
# echo "Custom build steps here"

echo "Build completed successfully."
