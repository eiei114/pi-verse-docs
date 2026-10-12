import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const release = readFileSync(new URL("../.github/workflows/auto-release.yml", import.meta.url), "utf8");
const publish = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");

function assertNoMergeTriggeredRelease(releaseWorkflow, publishWorkflow) {
  const releaseTriggers = releaseWorkflow.split(/^permissions:/m)[0];
  const publishTriggers = publishWorkflow.split(/^permissions:/m)[0];
  assert.match(releaseTriggers, /^on:\r?\n  workflow_dispatch:\s*$/m, "release must be manually triggered only");
  assert.doesNotMatch(releaseTriggers, /^\s+push:/m, "a merge must not start release");
  assert.match(releaseWorkflow, /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.match(publishTriggers, /push:\r?\n\s+tags:\r?\n\s+- 'v\*\.\*\.\*'/, "publishing must remain version-tag gated");
  assert.doesNotMatch(publishTriggers, /branches:|paths:/, "main branch/package edits must not publish");
  assert.match(publishTriggers, /release:\r?\n\s+types: \[published\]/);
  assert.match(publishTriggers, /workflow_dispatch:/, "explicit manual publishing remains available to the owner");
}

test("merging code cannot directly or indirectly trigger npm publish or release", () => {
  assert.doesNotThrow(() => assertNoMergeTriggeredRelease(release, publish));
  assert.throws(() => assertNoMergeTriggeredRelease(release.replace("  workflow_dispatch:", "  push:\n    branches: [main]\n  workflow_dispatch:"), publish));
  assert.throws(() => assertNoMergeTriggeredRelease(release, publish.replace("    tags:", "    branches: [main]\n    tags:")));
});

test("manual release rejects malformed SemVer without leading zeroes", () => {
  const pattern = release.match(/grep -Eq '([^']+)'/)?.[1];
  assert.ok(pattern, "manual release must validate stable SemVer");
  const stableSemver = new RegExp(pattern);
  for (const version of ["0.0.0", "0.3.8", "10.20.300"]) assert.match(version, stableSemver);
  for (const version of ["00.3.8", "0.03.8", "0.3.08", "0.3", "0.3.8-beta"]) {
    assert.doesNotMatch(version, stableSemver);
  }
});
