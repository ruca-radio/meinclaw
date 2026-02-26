#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Removing previously installed OpenClaw service/app (config kept)"
if command -v openclaw >/dev/null 2>&1; then
  openclaw uninstall --service --app --yes --non-interactive || true
fi

echo "==> Removing previously installed global OpenClaw packages"
if command -v npm >/dev/null 2>&1; then
  npm rm -g openclaw >/dev/null 2>&1 || true
fi
if command -v pnpm >/dev/null 2>&1; then
  pnpm remove -g openclaw >/dev/null 2>&1 || true
fi
if command -v bun >/dev/null 2>&1; then
  bun remove -g openclaw >/dev/null 2>&1 || true
fi

echo "==> Removing old local build/dependency artifacts"
rm -rf node_modules dist ui/dist ui/node_modules

echo "==> Installing dependencies and rebuilding from this repo"
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@10.23.0 --activate
fi
pnpm install --frozen-lockfile
pnpm ui:build
pnpm build

echo "==> Done. Existing configuration was preserved (default root path: ${OPENCLAW_STATE_DIR:-$HOME/.openclaw})"
