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

echo "--- Testing Workflow Step Execution & Injection Protection ---"
# Parse and execute the actual step defined in .github/workflows/ci.yml
# to verify that it uses environment variable transport and prevents command substitution.
python3 -c '
import yaml, subprocess, os, sys

CI_WORKFLOW = "'"${REPO_ROOT}"'/.github/workflows/ci.yml"
with open(CI_WORKFLOW) as f:
    wf = yaml.safe_load(f)

step = None
for s in wf["jobs"]["build-and-publish"]["steps"]:
    if s.get("name") == "Validate Strict SemVer Release Tag":
        step = s
        break

if not step:
    print("ERROR: Step Validate Strict SemVer Release Tag not found in ci.yml!", file=sys.stderr)
    sys.exit(1)

run_cmd = step.get("run", "")
env_bindings = step.get("env", {})

# 1. Structural security assertion: reject inline GitHub expression interpolation
if "${{ github.ref_name }}" in run_cmd or "${{ github.ref }}" in run_cmd:
    print("ERROR: Inlined GitHub expression detected in run command!", file=sys.stderr)
    sys.exit(1)

if env_bindings.get("RELEASE_TAG") != "${{ github.ref_name }}":
    print("ERROR: RELEASE_TAG not bound to ${{ github.ref_name }} in step env!", file=sys.stderr)
    sys.exit(1)

# 2. Execution emulation with malicious payload
marker_file = "/tmp/antigravity_step_marker_" + str(os.getpid())
if os.path.exists(marker_file):
    os.remove(marker_file)

payload = "v$(touch " + marker_file + ").0.0"

# Emulate GitHub Actions runner: sets env and substitutes expressions in run_cmd
env = dict(os.environ)
for k, v in env_bindings.items():
    if v == "${{ github.ref_name }}":
        env[k] = payload
    else:
        env[k] = v

resolved_cmd = run_cmd.replace("${{ github.ref_name }}", payload)

res = subprocess.run(resolved_cmd, shell=True, env=env, cwd="'"${REPO_ROOT}"'", capture_output=True, text=True)

if os.path.exists(marker_file):
    os.remove(marker_file)
    print("FAILED: Command substitution was executed by workflow step!", file=sys.stderr)
    sys.exit(1)

if res.returncode == 0 or "ERROR:" not in res.stderr:
    print("FAILED: Malicious tag was not rejected by workflow step validator!", file=sys.stderr)
    sys.exit(1)

print("SUCCESS: Workflow step executed safely with environment variable transport.")
'

echo "=== All Release Tag Validation Tests Passed (20/20) ==="
