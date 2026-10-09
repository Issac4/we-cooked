#!/usr/bin/env bash
# scripts/validate-release-tag.sh
# Validates whether a Git tag conforms to the strict stable release policy (vMAJOR.MINOR.PATCH)
# for production container image publishing.

set -euo pipefail

validate_tag() {
  local tag="${1:-}"

  if [[ -z "${tag}" ]]; then
    echo "ERROR: Tag name is empty." >&2
    return 1
  fi

  if [[ ${#tag} -gt 128 ]]; then
    echo "ERROR: Tag '${tag}' exceeds maximum Docker tag length of 128 characters." >&2
    return 1
  fi

  # Strict SemVer 2.0 release pattern: vMAJOR.MINOR.PATCH (non-negative integers without leading zeros)
  local semver_regex='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
  if [[ ! "${tag}" =~ ${semver_regex} ]]; then
    echo "ERROR: Tag '${tag}' is not a valid strict release tag (expected 'vMAJOR.MINOR.PATCH', e.g. 'v1.0.0')." >&2
    echo "Prereleases (-rc, -alpha), build metadata (+build), and malformed names are rejected from production release." >&2
    return 1
  fi

  echo "SUCCESS: Tag '${tag}' is a valid stable release tag."
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <tag-name>" >&2
    exit 1
  fi
  validate_tag "$1"
fi
