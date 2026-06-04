# Release

This package uses npm Trusted Publishing with GitHub Actions OIDC.

Do not add `NPM_TOKEN` or long-lived npm tokens to GitHub Secrets.

## One-time npm setup

On npmjs.com, configure Trusted Publishing for this package:

- Publisher: GitHub Actions
- Repository: this GitHub repository
- Workflow filename: `publish.yml`

## Publish

### Recommended: GitHub Actions Trusted Publishing

```bash
npm version patch
git push
```

On `main`, `.github/workflows/auto-release.yml` checks `package.json` version. If `v<version>` does not exist yet, it creates the tag, creates the GitHub Release, then explicitly dispatches `.github/workflows/publish.yml` for that tag.

The `v*.*.*` tag also triggers `.github/workflows/publish.yml`, which runs CI and publishes to npm when tags are pushed manually.
Publishing also runs when a GitHub Release is published, and can be run manually from GitHub Actions with `workflow_dispatch`.

The workflow skips `name@version` if that exact package version already exists on npm.

### Manual local publish with OTP

If you want to publish directly from a maintainer machine instead of GitHub Actions:

```bash
npm run ci
npm publish --access public
```

- `npm whoami` should already work
- npm CLI will prompt for OTP if your account requires 2FA for publish
- you can also pass `--otp=<code>` explicitly
- package name/version must not already exist on npm
- uncommitted local files are what get published, so review `git status` first

## GitHub Actions requirements

- `permissions: id-token: write`
- `permissions: actions: write` on auto-release so it can dispatch `publish.yml`
- GitHub-hosted runner
- Node.js 24, so the release job uses a current npm CLI for Trusted Publishing
- No `NPM_TOKEN`
- `npm publish` from the configured workflow file

## First release checklist

- [ ] `package.json` name is final
- [ ] `repository.url` points to the real GitHub repository
- [ ] npm Trusted Publisher is configured
- [ ] `npm run ci` passes
- [ ] `npm pack --dry-run` contains only intended files
- [ ] `CHANGELOG.md` has the release date
- [ ] If publishing locally, `npm whoami` works and OTP device/app is ready
