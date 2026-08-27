#!/usr/bin/env bash
# Idempotent Bun installer — wraps the official installer and sets up PATH.
# Safe to re-run; skips re-install if bun is already present.
set -euo pipefail

if command -v bun &>/dev/null; then
    echo "bun already installed: $(bun --version)"
    exit 0
fi

if [ -x "$HOME/.bun/bin/bun" ]; then
    echo "bun binary found at ~/.bun/bin/bun, adding to PATH"
    export PATH="$HOME/.bun/bin:$PATH"
    echo "bun version: $(bun --version)"
    exit 0
fi

echo "Installing bun via official installer..."
curl -fsSL https://bun.sh/install | bash

# Ensure PATH is set for the current session
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "bun installed: $(bun --version)"
