# ROADMAP

## Current release status

**Latest release:** v0.3.1 (2026-06-05) — `verse_docs_list_chapters` / `verse_docs_list_api_modules` tools and human commands.

**In development:** v0.4.0 — maintenance and cleanup phase.

**Shipped:**

| Version | Date | Highlights |
|---------|------|-----------|
| 0.3.1 | 2026-06-05 | Changelog housekeeping |
| 0.3.0 | 2026-06-05 | List tools for chapters and API modules |
| 0.2.0 | 2026-06-04 | MVP — on-demand MCP client, 6 core tools, verse-dev skill |
| 0.1.2 | 2026-06-04 | Minimal-docs policy alignment |
| 0.1.1 | 2026-06-01 | Publish workflow fixes (npm Trusted Publishing) |
| 0.1.0 | — | Initial Pi package template bootstrap |

---

## Short-term goals (v0.4.0 – v0.5.0)

### Template cleanup

The repository still carries three template bootstrap docs that were marked for deletion or merge in `docs/template-checklist.md`. These should be cleaned up before v0.4.0.

- Remove `docs/github-template.md`, `docs/repository-settings.md`, `docs/typescript.md`
- Update `docs/examples.md` to reference the actual verse-docs tools/commands instead of the old template examples (`hello.ts`, `example-skill`, etc.)
- Remove `docs/template-checklist.md` itself once all items are resolved or acknowledged
- Verify `package.json` `files` field excludes any removed docs

### Documentation improvements

- Create `docs/usage.md` with a detailed walkthrough covering the recommended workflow (status → cache → search → get) with realistic Verse/UEFN examples
- Add a troubleshooting section covering common `verse-mcp` setup failures (Python missing, uvx not found, cache permissions)

### Test quality

- Add unit tests for `lib/formatters.ts` (truncation edge cases, non-text MCP results)
- Add mock-based tests for `verse_docs_status` tool execution path
- Evaluate adding a linting step (e.g., `eslint` or `biome`) to CI

---

## Candidate maintenance seeds

> Each item below is scoped to 30–90 minutes and can be turned into a standalone issue.

### Seed 1: Remove stale template bootstrap docs (~30 min)

**What:** Delete `docs/github-template.md`, `docs/repository-settings.md`, `docs/typescript.md`, and `docs/template-checklist.md`. Update `package.json` `files` to only include `docs/examples.md` and `docs/release.md` (the two docs that have real project value).

**Why:** These files were generated from the Pi extension template and add noise for consumers and contributors. The template-checklist itself says to delete them after setup.

**Acceptance criteria:**
- Four template docs are deleted
- `package.json` `files` reflects remaining docs
- `npm run pack:check` passes
- No broken doc references remain in README

### Seed 2: Update docs/examples.md for actual verse-docs (~45 min)

**What:** Rewrite `docs/examples.md` to showcase the real verse-docs tools and commands instead of template placeholders (`hello.ts`, `template-info`, `example-skill`). Include examples for `verse_docs_search_api`, `verse_docs_list_chapters`, and the human commands.

**Why:** The current examples.md is pure template boilerplate — it references files and tools that don't exist in this project.

**Acceptance criteria:**
- `docs/examples.md` references only existing verse-docs tools/commands
- At least 3 realistic Verse/UEFN query examples included
- README links section (if any) still points to valid docs

### Seed 3: Add formatter unit tests (~45 min)

**What:** Add `tests/formatters.test.mjs` covering `formatMcpTextResult` and `formatCacheAllResult` — test truncation at boundary, string input, missing `content` array, non-text content items, and `formatCacheAllResult` cache-dir appending.

**Why:** `lib/formatters.ts` handles all output truncation and formatting but has zero direct test coverage. Edge cases (empty results, non-standard MCP responses) could break silently.

**Acceptance criteria:**
- `tests/formatters.test.mjs` covers truncation, string passthrough, missing content, non-text items
- `npm test` passes with new tests
- No `verse-mcp` runtime dependency in tests (pure unit tests)

### Seed 4: Add mock-based verse_docs_status test (~60 min)

**What:** Add a test to `tests/verse-docs.test.mjs` (or a new `tests/verse-docs-status.test.mjs`) that mocks `resolveVerseMcpCommand` and the MCP client to verify the `callVerseDocsTool` execution path for `status` returns correctly formatted output. Use the existing `resolveCommand` and `request` injection points in `VerseDocsCallOptions`.

**Why:** The status tool is the first thing users run. End-to-end testing of the call path (resolve → request → format) catches integration regressions without requiring a real `verse-mcp` install.

**Acceptance criteria:**
- Mocked resolve and request verify full call chain
- Test covers successful status and error (spawn_failed) cases
- `npm test` passes

### Seed 5: Add troubleshooting section to docs (~45 min)

**What:** Add a troubleshooting section to README or a new `docs/usage.md` covering: Python not found, `uvx` not found, `verse-mcp` install failures, cache permission issues, and MCP timeout recovery.

**Why:** Users hit setup issues before getting value from the tools. Actionable troubleshooting reduces friction and support overhead.

**Acceptance criteria:**
- Covers at least 4 common failure scenarios
- Each scenario has a clear resolution step
- Linked from README

### Seed 6: Evaluate and add a lint step to CI (~45 min)

**What:** Evaluate `biome` or `eslint` for the codebase. Add the chosen linter as a devDependency, configure it for the existing TypeScript strict setup, add a `lint` script, and wire it into the CI workflow.

**Why:** No automated style or correctness checking exists beyond `tsc --noEmit`. A linter catches issues that the type checker doesn't (unused imports, inconsistent formatting, etc.).

**Acceptance criteria:**
- Linter runs on `lib/` and `extensions/` with zero new warnings on current code
- `npm run lint` added as a script
- CI workflow updated to run lint
- `npm run ci` includes lint step

---

## Areas for future consideration (post-v0.5.0)

These are not yet scoped into seeds but are on the radar for future planning:

- **Upstream verse-mcp version tracking:** Pin or document compatible upstream versions; auto-check for new releases
- **Result caching layer:** Local in-process cache to avoid redundant MCP spawns for repeated identical queries within a session
- **Additional upstream tools:** Wrap any new tools added by `verse-mcp` (e.g., code examples, snippet lookup)
- **Verse code snippets skill:** A dedicated skill that combines search + get into a Verse code generation workflow
- **Metrics/telemetry:** Anonymous usage counters to understand which tools/commands are most valuable
