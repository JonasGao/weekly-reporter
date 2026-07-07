#!/usr/bin/env bash

# Check if commit message contains non-ASCII characters
MSG=$(cat "$1")

if echo "$MSG" | grep -qP '[^\x00-\x7F]'; then
  echo "❌ Commit message must be in English (ASCII characters only)"
  echo "   Found non-ASCII characters in: $MSG"
  exit 1
fi

echo "✓ Commit message is ASCII-only"
exit 0
