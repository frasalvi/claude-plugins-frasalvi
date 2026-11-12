#!/usr/bin/env bash
# Generate one image with GPT through the Codex CLI and copy it to OUT.
# Review tier: plumbing
#
# Usage: gen_image.sh OUT.png "prompt" [reference.png ...]
# Env: CODEX_BIN (default: codex on PATH, then ~/.npm-global/bin/codex)
#      GPT_IMAGE_MODEL (default: gpt-6.1-sol)
# Notes: stdin must be /dev/null or codex waits for input; the prompt goes after "--" because --image
# takes several values; codex saves the image under ~/.codex/generated_images/<session id>/, which we
# find from the session id in its log. A read-only sandbox is enough: the image tool saves on its own.
set -euo pipefail
out="$1"; prompt="$2"; shift 2
codex_bin="${CODEX_BIN:-$(command -v codex || echo "$HOME/.npm-global/bin/codex")}"
model="${GPT_IMAGE_MODEL:-gpt-6.1-sol}"
work="$(mktemp -d)"
imgs=()
for r in "$@"; do imgs+=("--image=$(realpath "$r")"); done
"$codex_bin" exec -m "$model" -s read-only --skip-git-repo-check --ephemeral -C "$work" ${imgs[@]+"${imgs[@]}"} -- "$prompt" \
  < /dev/null > "$work/log.txt" 2>&1 || true
sid="$(grep -o 'session id: [0-9a-f-]*' "$work/log.txt" | head -1 | awk '{print $3}' || true)"
img="$(ls -t "$HOME/.codex/generated_images/$sid/"*.png 2>/dev/null | head -1 || true)"
if [ -z "$sid" ] || [ -z "$img" ]; then echo "no image produced; log: $work/log.txt" >&2; exit 1; fi
mkdir -p "$(dirname "$out")"
cp "$img" "$out"
echo "$out"
