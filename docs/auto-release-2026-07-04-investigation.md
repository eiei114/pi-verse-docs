# Auto Release run 28704560271 investigation

## Scope

This report records the failed `Auto Release` run from 2026-07-04 without changing release workflows, package version, changelog, npm registry state, or any release artifact.

- Failed run: <https://github.com/eiei114/pi-verse-docs/actions/runs/28704560271>
- Workflow: `Auto Release` (`.github/workflows/auto-release.yml`)
- Run event: `push`
- Ref / branch: `main`
- Head SHA: `25f33cdb8f01ed4100271652497b44fc6666e35e`
- Display title: `Merge pull request #19 from eiei114/chore/sponsor-funding-patch-20260704`
- Created: `2026-07-04T11:20:04Z`
- Result: failure in job `Create release for new version`, step `Trigger publish workflow`

## Version and public npm state

The run compared `github.event.before` (`48511cbd67131171d1fe706bb6852777447b3fc4`) with the checked-out head and detected a package version bump:

```text
Version bump detected: 0.3.1 -> 0.3.2.
```

Current source package version:

```bash
node -p "require('./package.json').version"
# 0.3.2
```

Current npm public state:

```bash
npm view pi-verse-docs version dist-tags versions --json
```

Observed result:

```json
{
  "version": "0.3.2",
  "dist-tags": { "latest": "0.3.2" },
  "versions": ["0.2.0", "0.3.1", "0.3.2"]
}
```

`npm view pi-verse-docs@0.3.2 version time dist.tarball --json` shows `0.3.2` was published at `2026-07-04T11:20:37.537Z` with tarball `https://registry.npmjs.org/pi-verse-docs/-/pi-verse-docs-0.3.2.tgz`.

GitHub release state:

```bash
gh release view v0.3.2 --json tagName,name,publishedAt,targetCommitish,url,isDraft,isPrerelease
```

Observed result: release `v0.3.2` is published, non-draft, non-prerelease, URL <https://github.com/eiei114/pi-verse-docs/releases/tag/v0.3.2>, `publishedAt` `2026-07-04T11:20:12Z`.

## Failure output

The failing step ran:

```bash
TAG="v0.3.2"
gh workflow run publish.yml --ref "$TAG" -f ref="$TAG"
```

The output was:

```text
HTTP 401: Bad credentials (https://api.github.com/repos/eiei114/pi-verse-docs/actions/workflows/publish.yml)
Try authenticating with:  gh auth login -h github.com
Error: Process completed with exit code 1.
```

The preceding step successfully created and pushed tag `v0.3.2` and created the GitHub Release.

## Current release / publish behavior

`auto-release.yml` runs on pushes to `main` that include `package.json`. When the package version changes and tag `v<version>` does not exist, it:

1. creates the tag,
2. pushes the tag,
3. creates a GitHub Release,
4. explicitly dispatches `publish.yml` for the tag using `gh workflow run publish.yml --ref "$TAG" -f ref="$TAG"`.

`publish.yml` can run from several triggers:

- push to `main` when `package.json`, `package-lock.json`, or `.github/workflows/publish.yml` changes,
- push tag `v*.*.*`,
- published GitHub Release,
- manual `workflow_dispatch`.

For the same 2026-07-04 push, a separate `Publish to npm` run also started at `2026-07-04T11:20:04Z` and succeeded: <https://github.com/eiei114/pi-verse-docs/actions/runs/28704560307>. Its `Publish package` job completed successfully, including `Validate package`, `Skip already published version`, and `Publish to npm`. This matches the public npm state for `pi-verse-docs@0.3.2`.

## Classification

Classification: **Trusted Publishing/authentication**.

The package was not blocked by a duplicate npm version: `0.3.2` did publish successfully. The observed failing operation was GitHub CLI authentication for the explicit workflow dispatch in `auto-release.yml`, returning `HTTP 401: Bad credentials`.

One local configuration smell is that the `Trigger publish workflow` step currently sets:

```yaml
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n
```

The literal trailing `\n` is not present in the earlier successful `Create tag and release` step's token assignment and is a plausible cause of the bad credentials seen only in the dispatch step. The already-successful publish run means the failure did not prevent npm publication for this release.

## Reproducible non-publish checks

Use read-only commands only; do not rerun or dispatch workflows:

```bash
# Confirm source version.
node -p "require('./package.json').version"

# Confirm public npm state without publishing.
npm view pi-verse-docs version dist-tags versions --json
npm view pi-verse-docs@0.3.2 version time dist.tarball --json

# Confirm failed auto-release evidence.
gh run view 28704560271 --json name,event,headBranch,headSha,createdAt,updatedAt,status,conclusion,url,workflowName,displayTitle,jobs
# Optional log evidence; still read-only.
gh run view 28704560271 --log-failed

# Confirm the publish workflow already succeeded for the same push.
gh run view 28704560307 --json name,event,headBranch,headSha,createdAt,updatedAt,status,conclusion,url,workflowName,displayTitle,jobs

# Local CI / package dry-run only; no publish.
npm run ci
```

## Smallest safe correction options

No correction is applied in this investigation. Safe follow-up options, smallest first:

1. Remove the literal trailing `\n` from `GH_TOKEN` in the `Trigger publish workflow` step.
2. Consider removing the explicit `gh workflow run publish.yml ...` dispatch and rely on the existing tag / release / main push triggers, or make the dispatch step non-fatal after confirming the tag/release triggers are sufficient.
3. If keeping the explicit dispatch, add a non-publish validation check such as `gh workflow view publish.yml` using the same token before dispatch, and document the expected permissions.

Because `publish.yml` already skips an existing package version, duplicate-version handling appears to be covered for the publish job itself.
