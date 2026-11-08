# Pi SDK compatibility

`pi-verse-docs` is verified against the frozen Pi SDK wave below.

- `@earendil-works/pi-agent-core`: `1.5.0`
- `@earendil-works/pi-ai`: `1.5.0`
- `@earendil-works/pi-coding-agent`: `1.5.0`
- `@earendil-works/pi-tui`: `1.5.0`

These are exact development and test pins only. The published peer dependency
ranges stay `*` so the package keeps working against the Pi version that hosts
it. `npm run smoke:pi` refuses to run when an installed SDK version differs from
the manifest pin, so a stale `node_modules` cannot produce passing evidence.

## 1.5.0 migration notes that apply here

The official [Pi v1.5.0 release notes](https://github.com/earendil-works/pi/releases/tag/v1.5.0)
move tool argument validation to `@earendil-works/pi-schema`.
`pi-verse-docs` needs no API migration for this change, because every tool
schema is plain JSON Schema:

- `extensions/index.ts` builds schemas with `Type.Object`, `Type.String`,
  `Type.Number`, `Type.Boolean` and `Type.Optional` only, and imports `Type` from
  `typebox` rather than from `@earendil-works/pi-ai`.
- The package never uses `Type.Refine()`, `Type.BigInt()`, `Type.Undefined()`,
  `Type.Void()`, TypeBox codecs or `Format.Set()` formats. Those features are
  outside JSON Schema and no longer apply to tool arguments; a constraint added
  later must be checked inside `execute()` instead of the schema.
- `StringEnum` is not used. Tool parameters are plain `string` values, so the
  pi-schema `Schema<T>` typing of `StringEnum` does not affect this package.

Two behavioural consequences do reach this package:

1. Pi now coerces loosely typed arguments before validation, so a numeric string
   becomes a number, `"true"` becomes `true`, and `null` in an optional property
   is dropped. `maxChars` and `timeoutMs` therefore always arrive as numbers or
   as `undefined`; the extension keeps using `?? default` and never relies on Pi
   rejecting a string.
2. Validation failures the model sees list pi-schema messages (`- query: missing`,
   `- maxChars: expected number, got string`) instead of TypeBox messages. No
   test or document in this repository asserts the old wording.

`pi-coding-agent` 1.5.0 pins `typebox` to exactly `1.3.27`, so the lockfile keeps
that version and `npm ls typebox` shows a single copy. Moving `typebox` to 1.4.x
would install a second copy next to Pi's own.

The 1.2.0 migration notes still matter for future edits: `before_agent_start`
carries a `messageType` union (`user` with `prompt` and `images`, `custom` with
`message`), and `ctx.isIdle()` is false while startup handlers run, so
`sendUserMessage()` needs `deliverAs` in that window. This package registers
commands and tools only and does not use those events.

## Runtime verification

```bash
npm install
npm run smoke:pi
```

`npm run ci` runs the same harness after typecheck, lint, the documentation
tests, the unit tests and before the pack dry-run, so CI executes the smoke
instead of only linting its report. The CI workflow runs that command on both
`ubuntu-latest` and `windows-latest`, so the POSIX and Windows shell branches of
`host_shell` and the Windows `.cmd` MCP launcher are exercised on a real host of
each kind.

The harness starts the real locally pinned Pi CLI (`--offline --no-session
--mode rpc -e .`) and asserts five cases against parsed protocol responses:

| Case | What is asserted |
|---|---|
| `extension_load` | Pi lists `verse-docs:search` as a registered extension command |
| `happy_path` | `/verse-docs:search decides` is handled and returns the fixture result `SMOKE_RESULT:decides` |
| `error_path` | an MCP error is surfaced as a handled error notification while Pi still handles the command |
| `reload_cleanup` | a second actual Pi process registers the command, returns the fixture result, and both hosts exit cleanly |
| `host_shell` | the native host shell (PowerShell on Windows, `/bin/sh` on POSIX) launches the pinned CLI and prints exactly `1.5.0` |

Every case also fails on unhandled rejection, extension load error or a non-zero
exit, and `tests/pi-sdk-smoke-contract.test.mjs` feeds the assertion helpers
deliberately missing or malformed responses to prove they fail. The committed
result is [`docs/verification/pi-sdk-smoke.json`](verification/pi-sdk-smoke.json)
with `verification_contract=pi-sdk-behavior-v2` and the four frozen versions.

`tests/pi-sdk-tool-schema.test.mjs` covers the 1.5.0 validation change without a
live model: it loads this extension through the real Pi loader, asserts that all
eight tool schemas compile under the host's own `@earendil-works/pi-schema`, and
checks the coerced argument and both error messages a model would see. It fails
if a schema starts using a TypeBox-only keyword, and it proves only one
`pi-schema` copy is installed so the validator under test is Pi's.

The feature path is deterministic and offline: a temporary stdio MCP fixture
answers `search_verse_docs`, so verification makes no paid model request and
needs no network. Pi's extension loader, RPC handling, command dispatch,
extension lifecycle and output formatting are real, not mocked. Provider
inference is outside this compatibility contract, so a `happy_path` pass shows
the extension feature path, not a model answer. The harness runs with an
isolated `PI_CODING_AGENT_DIR` under the system temp directory and removes it
afterwards; production and global Pi settings are never touched.

## Reusing the template baseline

The API migration guidance for this wave was first verified on
`pi-extension-template` (DOT-3243) and is reused here instead of being
researched again. This package adds its own evidence on top of that baseline:

- the feature path is a slash command that shells out through `verse-mcp` over
  stdio, not the template's greeting tool;
- the fixture also covers a failing MCP call and a Windows `.cmd` launcher,
  because `lib/verse-mcp-locator.ts` resolves `PATHEXT` candidates;
- the native shell boundary is asserted through the pinned CLI's `--version`,
  which fails if the shell picks up another Pi install.

Do not copy the template's fixture assertions as proof of this package's
behaviour; adapt the case list above when a feature path changes.
