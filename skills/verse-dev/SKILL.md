---
name: verse-dev
description: Guide for using pi-verse-docs during Verse / UEFN work. Use when the user is writing Verse code, checking Verse APIs, asking about UEFN docs, or mentions verse-mcp.
---

# Verse Dev

Use this skill when the user is working on Verse, UEFN APIs, or Verse MCP-backed reference lookup.

## Default flow

1. If setup may be missing, call `verse_docs_status` first.
2. If this machine has not warmed the cache yet, suggest `verse_docs_cache_all`.
3. For UEFN devices, classes, methods, and modules, use `verse_docs_search_api` **before guessing names**.
4. For language semantics like `decides`, failure contexts, concurrency, modules, or effects, use `verse_docs_search`.
5. If search results are not enough, use:
   - `verse_docs_get_chapter`
   - `verse_docs_get_api_module`

## Rules

- Do not hallucinate UEFN API names when `verse_docs_search_api` can verify them.
- Prefer `verse_docs_search_api` before writing non-trivial gameplay / device code.
- Prefer `verse_docs_search` for syntax and semantics, not API surface.
- Mention compile or diagnostics tooling separately: `pi-verse-docs` is reference lookup only.

## Adjacent tools

- Verse compile / LSP diagnostics: external `verse-diagnostics-mcp` style tools
- UEFN editor automation: separate editor-control MCPs, not bundled here
- Ecosystem context: `4_Project/OSS/pi-verse-docs/Docs/uefn-mcp-ecosystem.md`
