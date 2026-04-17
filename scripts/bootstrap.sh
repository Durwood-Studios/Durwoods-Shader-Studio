#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
pnpm install

echo "==> Installing Husky hooks..."
pnpm husky install

echo "==> Generating shader manifests..."
pnpm gen:manifests

echo ""
echo "========================================"
echo "  Bootstrap complete. Manual checklist:"
echo "========================================"
echo ""
echo "  [ ] Create a GitHub repository"
echo "       gh repo create shader-studio --private"
echo ""
echo "  [ ] Push this repo"
echo "       git init"
echo "       git add ."
echo "       git commit -m 'chore: initial scaffold'"
echo "       git remote add origin <your-repo-url>"
echo "       git push -u origin main"
echo ""
echo "  [ ] Connect Vercel"
echo "       vercel link   (or connect via vercel.com dashboard)"
echo "       vercel env add   (if any env vars are needed)"
echo ""
echo "  [ ] Verify CI is green on GitHub Actions"
echo ""
echo "  [ ] Confirm Vercel preview URL appears on first PR"
echo ""
