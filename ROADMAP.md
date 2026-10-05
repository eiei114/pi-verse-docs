# ROADMAP

## Current release status

**Last refreshed:** 2026-10-06.

**Latest release:** v0.3.7 (2026-09-30) — npm published; updates the Pi SDK dependencies to 0.99.1.

**In development:** v0.4.0 — lookup reliability, test coverage, and contributor-facing docs.

**Shipped (recent):**

| Version | Date | Highlights |
|---------|------|-----------|
| 0.3.7 | 2026-09-30 | Pi SDK dependency update to 0.99.1 |
| 0.3.6 | 2026-09-27 | Periodic patch release after the publish gap |
| 0.3.5 | 2026-08-22 | Managed OSS dependency batch; examples doc refresh (DOT-1549) |
| 0.3.3 | 2026-07-20 | Sponsor/funding links; template bootstrap doc removal (DOT-1238) |
| 0.3.0 | 2026-06-05 | `verse_docs_list_chapters` / `verse_docs_list_api_modules` tools |
| 0.2.0 | 2026-06-04 | MVP — on-demand MCP client, 6 core tools, verse-dev skill |

---

## Short-term priorities (v0.4.0 – v0.5.0)

Focus areas for the next one to two releases:

1. **Lookup reliability** — tighten error messages, timeout guidance, and cache warm-up docs so first-time users recover from setup failures without support.
2. **Test coverage gaps** — add direct unit tests for formatters and status formatting; keep integration tests mock-based (no live `verse-mcp` in CI).
3. **Contributor hygiene** — keep the lightweight lint and documentation checks green; archive one-off investigation docs that are no longer actionable.
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

### Seed 3: Add prerequisite troubleshooting to README (~45 min)

**What:** Add a **Troubleshooting** section to README covering Python not found, `uvx` not found, and `verse-mcp` installation failures.

**Why:** Users hit setup issues before getting value from search tools. Actionable prerequisite recovery steps reduce repeated support questions.

**Acceptance criteria:**
- Covers the three prerequisite failure scenarios
- Each scenario has a clear resolution step
- Linked from the Recommended workflow section

### Seed 4: Document search and cache tuning (~45 min)

**What:** Add a README troubleshooting section covering `maxChars`, timeout recovery, cache warm-up, and cache permission failures; link it from the recommended workflow.

**Why:** First-time lookup failures are the main remaining support path, and the existing notes do not explain how to recover from slow or partial upstream responses.

**Acceptance criteria:**
- Documents `maxChars` / timeout tuning and cache warm-up
- Includes actionable recovery steps for cache permission and MCP timeout failures
- Linked from the recommended workflow
- Documentation link tests pass

---

## Recently completed (no longer seed candidates)

These roadmap items shipped and should not be re-seeded:

- **Template bootstrap doc removal** — `docs/github-template.md`, `docs/repository-settings.md`, `docs/typescript.md`, and `docs/template-checklist.md` removed (DOT-1238, #27).
- **docs/examples.md refresh** — rewritten for real verse-docs tools/commands (DOT-1549, #36).
- **Auto-release reliability fix** — workflow made reliable (#30).
- **Biome lint and CI integration** — lint runs through `npm run ci` (DOT-1754, #40).
- **Markdown link check** — documentation links are checked in CI (DOT-1859, #43).
- **Auto-release investigation archive** — stale investigation note removed (DOT-1960, #45).

---

## Areas for future consideration (post-v0.5.0)

These are not yet scoped into seeds but are on the radar:

- **Upstream verse-mcp version tracking:** Pin or document compatible upstream versions; auto-check for new releases
- **Result caching layer:** Local in-process cache to avoid redundant MCP spawns for repeated identical queries within a session
- **Additional upstream tools:** Wrap any new tools added by `verse-mcp` (e.g., code examples, snippet lookup)
- **Verse code snippets skill:** A dedicated skill that combines search + get into a Verse code generation workflow
- **Metrics/telemetry:** Anonymous usage counters to understand which tools/commands are most valuable
