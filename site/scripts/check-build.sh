#!/usr/bin/env bash
# Fails the build if anything the specs ban reaches dist/.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

if grep -rl $'\xe2\x80\x94' dist --include='*.html'; then
  echo "FAIL: em dash in rendered HTML (files above)"; fail=1
fi

banned='gp-proposal-system|proposal-dashboard|ted-lasso|srishti-walk|srishti-ted'
if grep -rlE "$banned" dist || find dist -type f | grep -E "$banned"; then
  echo "FAIL: a do-not-use asset is referenced or shipped"; fail=1
fi

if grep -rliE 'open to work|hire me|available for roles|download (my )?cv|salary' dist --include='*.html'; then
  echo "FAIL: job-search phrase in rendered HTML"; fail=1
fi

[ "$fail" -eq 0 ] && echo "check-build: clean"
exit "$fail"
