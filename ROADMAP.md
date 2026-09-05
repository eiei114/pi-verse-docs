# ROADMAP

## Current release status

**Latest release:** v0.3.5 (2026-08-22) — npm published; includes dependency maintenance batch and refreshed `docs/examples.md`.

**In development:** v0.4.0 — reliability, test coverage, and contributor-facing docs.

**Shipped (recent):**

| Version | Date | Highlights |
|---------|------|-----------|
| 0.3.5 | 2026-08-22 | Managed OSS dependency batch; examples doc refresh (DOT-1549) |
| 0.3.3 | 2026-07-20 | Sponsor/funding links; template bootstrap doc removal (DOT-1238) |
| 0.3.1 | 2026-06-05 | Changelog housekeeping |
| 0.3.0 | 2026-06-05 | `verse_docs_list_chapters` / `verse_docs_list_api_modules` tools |
| 0.2.0 | 2026-06-04 | MVP — on-demand MCP client, 6 core tools, verse-dev skill |

---

## Short-term priorities (v0.4.0 – v0.5.0)

Focus areas for the next one to two releases:

1. **Lookup reliability** — tighten error messages, timeout guidance, and cache warm-up docs so first-time users recover from setup failures without support.
2. **Test coverage gaps** — add direct unit tests for formatters and status formatting; keep integration tests mock-based (no live `verse-mcp` in CI).
3. **Contributor hygiene** — add a lint step to CI and archive one-off investigation docs that are no longer actionable.
4. **Search/cache follow-ups** — document `maxChars` / timeout tuning and evaluate whether repeated identical queries within a session need a lightweight cache (future seed, not v0.4.0 blocker).

---

## Candidate maintenance seeds

> Each item below is scoped to **30–90 minutes** and can be turned into a standalone backlog issue.

### Seed 1: Add formatter unit tests (~45 min)

**What:** Add `tests/formatters.test.mjs` covering `formatMcpTextResult` and `formatCacheAllResult` — truncation at boundary, string passthrough, missing `content` array, non-text content items, and cache-dir appending.

**Why:** `lib/formatters.ts` handles all tool output truncation but has zero direct test coverage. Edge cases (empty MCP payloads, non-standard responses) could break silently and affect every tool.

**Acceptance criteria:**
- `tests/formatters.test.mjs` covers truncation, string passthrough, missing content, non-text items
- `npm test` passes with new tests
- No `verse-mcp` runtime dependency in tests (pure unit tests)

### Seed 2: Add mock-based status formatting tests (~60 min)

**What:** Add `tests/status.test.mjs` that mocks `resolveVerseMcpCommand`, `probePythonRuntime`, and MCP ping to verify `inspectVerseDocsStatus` and `formatVerseDocsStatus` output for ready, setup-needed, and ping-failure cases.

**Why:** `verse_docs_status` is the first tool users run. The status formatter drives install hints and readiness messaging; regressions here block all downstream lookup work.

**Acceptance criteria:**
- Mocked resolve/probe verify ready and setup-needed summaries
- Ping success and failure paths covered
- `npm test` passes

### Seed 3: Add troubleshooting section to README (~45 min)

**What:** Add a **Troubleshooting** section to README covering: Python not found, `uvx` not found, `verse-mcp` install failures, cache permission issues, and MCP timeout recovery (with pointer to `verse_docs_cache_all`).

**Why:** Users hit setup issues before getting value from search tools. Actionable troubleshooting reduces friction and repeated support questions.

**Acceptance criteria:**
- Covers at least 4 common failure scenarios
- Each scenario has a clear resolution step
- Linked from the Recommended workflow section

### Seed 4: Evaluate and add a lint step to CI (~45 min)

**What:** Evaluate `biome` or `eslint` for the codebase. Add the chosen linter as a devDependency, configure it for the existing TypeScript strict setup, add a `lint` script, and wire it into the CI workflow.

**Why:** No automated style or correctness checking exists beyond `tsc --noEmit`. A linter catches issues the type checker does not (unused imports, inconsistent formatting, etc.).

**Acceptance criteria:**
- Linter runs on `lib/` and `extensions/` with zero new warnings on current code
- `npm run lint` added as a script
- CI workflow updated to run lint
- `npm run ci` includes lint step

### Seed 5: Archive stale auto-release investigation doc (~30 min)

**What:** Move `docs/auto-release-2026-07-04-investigation.md` to a dated archive note in CHANGELOG or delete it after confirming the auto-release workflow fix (#30) is stable. Ensure no README or doc links reference the file.

**Why:** The investigation doc describes a resolved 2026-07-04 failure (package was 0.3.2 at time of writing). Keeping it in `docs/` adds noise for seed planners and contributors.

**Acceptance criteria:**
- Investigation doc removed or clearly archived with a one-line CHANGELOG note
- No broken doc references
- `npm run pack:check` passes

---

## Recently completed (no longer seed candidates)

These roadmap items shipped and should not be re-seeded:

- **Template bootstrap doc removal** — `docs/github-template.md`, `docs/repository-settings.md`, `docs/typescript.md`, and `docs/template-checklist.md` removed (DOT-1238, #27).
- **docs/examples.md refresh** — rewritten for real verse-docs tools/commands (DOT-1549, #36).
- **Auto-release reliability fix** — workflow made reliable (#30).

---

## Areas for future consideration (post-v0.5.0)

These are not yet scoped into seeds but are on the radar:

- **Upstream verse-mcp version tracking:** Pin or document compatible upstream versions; auto-check for new releases
- **Result caching layer:** Local in-process cache to avoid redundant MCP spawns for repeated identical queries within a session
- **Additional upstream tools:** Wrap any new tools added by `verse-mcp` (e.g., code examples, snippet lookup)
- **Verse code snippets skill:** A dedicated skill that combines search + get into a Verse code generation workflow
- **Metrics/telemetry:** Anonymous usage counters to understand which tools/commands are most valuable
