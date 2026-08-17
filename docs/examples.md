# Examples

This document shows realistic `pi-verse-docs` workflows for Verse language and UEFN API reference lookup. Every tool and command below exists in this package — see the [README](../README.md) for install prerequisites.

## Quick start

```bash
pi install git:github.com/eiei114/pi-verse-docs
```

Local development from a clone:

```bash
npm install
pi -e .
```

## Example 1: Verify setup before writing Verse code

**Scenario:** You are about to edit Verse gameplay code but are unsure whether Python and `verse-mcp` are available.

**Human command:**

```txt
/verse-docs:status
```

**Agent tool:**

```txt
verse_docs_status ping=true
```

**When to use:** First session on a machine, after Python upgrades, or when searches fail with spawn errors.

## Example 2: Look up language semantics (`decides`, failure)

**Scenario:** You need to confirm how `decides` affects failure contexts before refactoring a function.

**Agent tool:**

```txt
verse_docs_search query="decides"
```

**Follow-up for deeper reading:**

```txt
verse_docs_list_chapters
verse_docs_get_chapter chapterName="failure"
```

**Human command alternative:**

```txt
/verse-docs:search
```

Enter `decides` when prompted.

## Example 3: Confirm UEFN API names before device code

**Scenario:** You want to call methods on `creative_device` but do not want to guess the module spelling.

**Agent tool:**

```txt
verse_docs_search_api query="creative_device"
```

**Follow-up:**

```txt
verse_docs_list_api_modules
verse_docs_get_api_module moduleName="creative_device"
```

**Human command alternative:**

```txt
/verse-docs:search-api
```

## Example 4: Warm cache for repeated lookups

**Scenario:** You will search many chapters during a long UEFN session.

**Agent tool:**

```txt
verse_docs_cache_all
```

**Human command:**

```txt
/verse-docs:cache
```

Run once per machine or session; subsequent `verse_docs_search` and `verse_docs_search_api` calls are faster.

## Package layout

| Resource | Path | Role |
|----------|------|------|
| Extension entrypoint | `extensions/index.ts` | Registers slash commands and agent tools |
| Agent skill | `skills/verse-dev/SKILL.md` | Guides Pi agents during Verse / UEFN work |

The `verse-dev` skill encodes the same flow as the examples above:

1. `verse_docs_status` when setup is uncertain
2. `verse_docs_cache_all` when repeated lookups are expected
3. `verse_docs_search_api` before writing non-trivial device code
4. `verse_docs_search` for language semantics
5. `verse_docs_list_chapters` / `verse_docs_list_api_modules` for valid names
6. `verse_docs_get_chapter` / `verse_docs_get_api_module` for full reads

## Optional template placeholders

These files remain from the Pi package template and are not wired into `package.json` `pi` resources:

- `prompts/example.md`
- `themes/example-theme.json`

Remove them in a fork if you do not need prompt or theme samples.

## Related docs

- [README](../README.md) — install, tools table, recommended workflow
- [docs/release.md](release.md) — publishing and release process
