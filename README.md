# Pi Verse Docs

[![Join dotfield.xyz on Discord](https://img.shields.io/badge/Join%20dotfield.xyz%20on%20Discord-5865F2?logo=discord&logoColor=white)](https://discord.gg/4945dXZVW5)

[![CI](https://github.com/eiei114/pi-verse-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-verse-docs/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-verse-docs/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-verse-docs/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/pi-verse-docs.svg)](https://www.npmjs.com/package/pi-verse-docs)
[![npm downloads](https://img.shields.io/npm/dm/pi-verse-docs.svg)](https://www.npmjs.com/package/pi-verse-docs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](docs/release.md)
<a href="https://buymeacoffee.com/ekawano114m"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" height="60"></a>

> On-demand Verse / UEFN docs lookup for Pi via `verse-mcp`, without a resident MCP daemon.

## What this is

`pi-verse-docs` gives Pi agents short-lived Verse docs tools.

- No `.mcp.json` always-on MCP server
- Spawns `verse-mcp` only per tool call
- Covers Verse language docs and UEFN API digest lookup

## Prerequisites

One of these setups is required:

1. **Recommended:** `uvx`
   ```bash
   uvx --from git+https://github.com/BurgersJackson/verse-mcp verse-mcp
   ```
2. **Alternative:** Python 3.10+ plus pip-installed `verse-mcp`
   ```bash
   pip install git+https://github.com/BurgersJackson/verse-mcp.git
   ```

If Python is missing, install it from https://www.python.org/downloads/

## Install

From npm:

```bash
pi install npm:pi-verse-docs
```

From GitHub:

```bash
pi install git:github.com/eiei114/pi-verse-docs
```

Local development:

```bash
git clone https://github.com/eiei114/pi-verse-docs.git
cd pi-verse-docs
npm install
pi -e .
```

## Tools

| Tool | Purpose |
|---|---|
| `verse_docs_status` | Check Python / `verse-mcp` / cache readiness, optional MCP ping |
| `verse_docs_search` | Search Verse language docs |
| `verse_docs_search_api` | Search Verse / UEFN API digest |
| `verse_docs_list_chapters` | List Verse language book chapters |
| `verse_docs_get_chapter` | Read a full Verse book chapter |
| `verse_docs_list_api_modules` | List Verse / UEFN API digest modules |
| `verse_docs_get_api_module` | Read a full API digest section |
| `verse_docs_cache_all` | Warm the Verse docs cache |

## Commands

| Command | Purpose |
|---|---|
| `/verse-docs:status` | Show install / readiness summary |
| `/verse-docs:search` | Prompt for a Verse language docs query |
| `/verse-docs:search-api` | Prompt for a Verse / UEFN API query |
| `/verse-docs:list-chapters` | List Verse language book chapters |
| `/verse-docs:list-api-modules` | List Verse / UEFN API digest modules |
| `/verse-docs:cache` | Pre-download Verse chapters for faster searches |

## Recommended workflow

When working with Verse or UEFN:

1. Run `verse_docs_status` if environment setup is uncertain.
2. Run `verse_docs_cache_all` once per machine/session if repeated lookups are likely.
3. Use `verse_docs_search_api` before writing non-trivial UEFN API code.
4. Use `verse_docs_search` for language semantics like failure, decides, concurrency, effects, or modules.
5. Use `verse_docs_list_chapters` / `verse_docs_list_api_modules` when you need valid names before a full read.
6. Use `verse_docs_get_chapter` / `verse_docs_get_api_module` for deeper reading after search.
7. See [Troubleshooting](#troubleshooting) if setup or a lookup fails.

## Troubleshooting

Run `verse_docs_status` to check setup. Use `verbose: true` to list the
`python_checked` and `verse_mcp_checked` candidate paths. Its `python` and
`verse-mcp` lines report detection, `cache_dir` shows the cache location, and
`mcp_ping` appears when you request `ping: true`.

- **Python missing:** `Python 3.10+ was not found on PATH. Install from https://www.python.org/downloads/`
  Install Python 3.10 or newer from [python.org](https://www.python.org/downloads/),
  then restart Pi so it inherits the updated PATH.
- **Python too old:** `Found Python ${version.raw} at ${candidate}, but verse-mcp requires Python 3.10+`
  (for example, Python 3.9). Install Python 3.10 or newer and ensure that
  version is found on PATH.
- **Python version unknown:** `Found Python launcher at ${candidate}, but could not determine the version.`
  Check the reported candidate with `--version`;
  install or repair the Python launcher if it cannot report its version.
- **Neither `verse-mcp` nor `uvx` found:**
  `verse-mcp was not found on PATH, and uvx fallback is unavailable. Install verse-mcp or uv.`
  Install with `pip install
  git+https://github.com/BurgersJackson/verse-mcp.git`, or install `uv` and use
  the [uvx setup](#prerequisites).
- **Lookup timeout:** `verse-mcp timed out while running ${upstreamTool}. Retry, increase timeoutMs, or warm the cache with verse_docs_cache_all.`
  Retry the lookup, pass a larger `timeoutMs`, or run `verse_docs_cache_all` first.
- **`spawn_failed` / `process_exited`:** `Failed to run verse-mcp for ${upstreamTool}: ${error.message}`.
  Check the reported error and confirm the executable is on PATH;
  reinstall `verse-mcp` or `uv` if needed, then restart Pi.

On Windows, command lookup checks executable suffixes from `%PATHEXT%` for
PATH entries. Use `where.exe verse-mcp` or `where.exe uvx` to confirm Windows
can find the command; if neither resolves, install it or add its directory to
PATH, then restart Pi.

## Configuration

- `VERSE_MCP_CACHE_DIR` — override the local cache directory used by upstream `verse-mcp`
- `VERSE_DIGEST_PATH` — override the bundled Verse API digest used by upstream `verse-mcp`

Example:

```bash
VERSE_MCP_CACHE_DIR=/tmp/verse-cache pi
```

## Notes

- Search / get tool output is truncated for safety.
- First search can be slower before cache warm-up.
- `pi-verse-docs` is for **reference lookup**, not compile diagnostics or UEFN editor automation.
- For compile / LSP diagnostics, use a Verse diagnostics MCP separately.

## Development

```bash
npm install
npm run ci
```

## Release

This package is configured for npm Trusted Publishing. No `NPM_TOKEN` is stored in the repo.

Manual publish with npm 2FA / OTP is also supported from a logged-in maintainer machine.

```bash
npm run ci
npm publish --access public
```

If npm challenges for 2FA, the CLI will prompt for an OTP, or you can pass `--otp=<code>`.

See [`docs/release.md`](docs/release.md).

## Security

Pi packages execute code with your local permissions. Review extensions before installing third-party packages.

For vulnerability reporting, see [`SECURITY.md`](SECURITY.md).

## Links

- Examples: [docs/examples.md](docs/examples.md)
- Pi SDK compatibility: [docs/pi-sdk-compatibility.md](docs/pi-sdk-compatibility.md)
- npm: https://www.npmjs.com/package/pi-verse-docs
- GitHub: https://github.com/eiei114/pi-verse-docs
- Upstream MCP: https://github.com/BurgersJackson/verse-mcp

## License

MIT