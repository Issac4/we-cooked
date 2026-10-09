#!/usr/bin/env bash
# tests/test_release_tag_validation.sh
# Unit tests for scripts/validate-release-tag.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VALIDATE_SCRIPT="${REPO_ROOT}/scripts/validate-release-tag.sh"

echo "=== Testing Release Tag Validation Script ==="

VALID_TAGS=(
  "v1.0.0"
  "v0.1.0"
  "v0.0.1"
  "v2.15.3"
  "v100.200.300"
)

INVALID_TAGS=(
  ""
  "1.0.0"
  "v1.0"
  "v1"
  "vbanana"
  "v1.0.0-rc.1"
  "v1.0.0-alpha"
  "v1.0.0-beta.2"
  "v1.0.0+build.1"
  "v01.0.0"
  "v1.02.0"
  "v1.0.03"
  "v1.0.0.0"
  "v$(printf '1%.0s' {1..129}).0.0"
)

for tag in "${VALID_TAGS[@]}"; do
  if ! "${VALIDATE_SCRIPT}" "${tag}" >/dev/null 2>&1; then
    echo "FAILED: Expected valid tag '${tag}' to be accepted!" >&2
    exit 1
  fi
  echo "PASS (accepted): ${tag}"
done

for tag in "${INVALID_TAGS[@]}"; do
  if "${VALIDATE_SCRIPT}" "${tag}" >/dev/null 2>&1; then
    echo "FAILED: Expected invalid tag '${tag}' to be rejected!" >&2
    exit 1
  fi
  echo "PASS (rejected): '${tag}'"
done

echo "--- Testing Shell Injection Protection via Environment Variable Transport ---"
# Verify that passing a tag containing command substitution through an environment variable
# does not execute commands and is rejected safely.
TEST_MARKER_FILE="/tmp/antigravity_injection_marker_${$}"
rm -f "${TEST_MARKER_FILE}"

INJECTION_PAYLOAD="v\$(touch ${TEST_MARKER_FILE}).0.0"
OUTPUT=$(RELEASE_TAG="${INJECTION_PAYLOAD}" "${VALIDATE_SCRIPT}" "${INJECTION_PAYLOAD}" 2>&1 || true)

if [[ -f "${TEST_MARKER_FILE}" ]]; then
  rm -f "${TEST_MARKER_FILE}"
  echo "FAILED: Command substitution was executed during tag transport!" >&2
  exit 1
fi
rm -f "${TEST_MARKER_FILE}"

if ! echo "${OUTPUT}" | grep -q "ERROR:"; then
  echo "FAILED: Malicious tag was not rejected!" >&2
  exit 1
fi
echo "PASS: Tag containing command substitution safely rejected without execution."

echo "=== All Release Tag Validation Tests Passed (20/20) ==="
