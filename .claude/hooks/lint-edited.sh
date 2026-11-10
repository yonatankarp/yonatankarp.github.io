#!/usr/bin/env bash
# PostToolUse (Edit|Write): lint just the edited file (about a second); the full suite stays CI's.
f=$(jq -r '.tool_input.file_path // empty')
root=${CLAUDE_PROJECT_DIR:-$PWD}
rel=${f#"$root"/}
[ "$rel" = "$f" ] && exit 0   # outside the project (a scratch file): no config of ours applies
cd "$root" || exit 0

case "$rel" in
  *.js|*.mjs)        out=$(node_modules/.bin/eslint --no-warn-ignored "$rel" 2>&1) ;;
  web3d/pixel/*.py)  command -v uvx >/dev/null || exit 0
                     out=$(uvx ruff@0.14.3 check --quiet "$rel" 2>&1) ;;
  layouts/*)         out=$(node scripts/check-template-copy.js 2>&1) ;;
  *) exit 0 ;;
esac || { echo "$out" >&2; exit 2; }
