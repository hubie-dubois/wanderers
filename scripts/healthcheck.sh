#!/usr/bin/env bash
set -euo pipefail

SITE_URL="https://wanderers.hubiedubois.com/"
FUNC_URL="https://sosjuvjjmposjxomgazk.functions.supabase.co/submit-visitor"

printf 'Checking site...\n'
site_code=$(curl -sS -o /dev/null -w '%{http_code}' "$SITE_URL")
printf '  %s -> HTTP %s\n' "$SITE_URL" "$site_code"

printf 'Checking function preflight...\n'
func_code=$(curl -sS -o /dev/null -w '%{http_code}' -X OPTIONS "$FUNC_URL" \
  -H 'Origin: https://wanderers.hubiedubois.com' \
  -H 'Access-Control-Request-Method: POST')
printf '  %s -> HTTP %s (OPTIONS)\n' "$FUNC_URL" "$func_code"

if [[ "$site_code" != "200" ]]; then
  echo 'Site check failed.'
  exit 1
fi

if [[ "$func_code" != "200" ]]; then
  echo 'Function preflight check failed.'
  exit 1
fi

echo 'All checks passed.'
