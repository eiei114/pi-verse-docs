# Examples

`pi-verse-docs` ships one extension entrypoint, one Agent Skill, and optional template placeholders that are not published.

## Extension

`extensions/index.ts` registers:

- `/verse-docs:status`
- `/verse-docs:search`
- `/verse-docs:search-api`
- `/verse-docs:list-chapters`
- `/verse-docs:list-api-modules`
- `/verse-docs:cache`
- `verse_docs_status`, `verse_docs_search`, `verse_docs_search_api`, `verse_docs_list_chapters`, `verse_docs_list_api_modules`, `verse_docs_get_chapter`, `verse_docs_get_api_module`, and `verse_docs_cache_all`

Try it with:

```bash
pi -e .
```

Then run:

```txt
/verse-docs:status
```

Or call a tool from Pi:

```txt
verse_docs_search query="decides"
```

## Agent Skill

`skills/verse-dev/SKILL.md` guides Verse / UEFN workflows:

- check setup with `verse_docs_status`
- warm cache with `verse_docs_cache_all`
- verify API names with `verse_docs_search_api` before writing device code

## Optional template placeholders

These files remain from the Pi package template and are not wired into `package.json` `pi` resources:

- `prompts/example.md`
- `themes/example-theme.json`

Remove them if your fork does not need prompt or theme samples.
