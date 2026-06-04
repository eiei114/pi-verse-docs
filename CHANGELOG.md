# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## [0.3.0] - 2026-06-05

### Added

- `verse_docs_list_chapters` and `verse_docs_list_api_modules` tools wrapping upstream `list_chapters` and `list_verse_api_modules`.
- Human commands `/verse-docs:list-chapters` and `/verse-docs:list-api-modules` for enumerating chapters and API modules without positional args.

## [0.2.0] - 2026-06-04

### Added

- On-demand `verse-mcp` locator with direct `verse-mcp` PATH resolution and `uvx` fallback.
- One-shot stdio MCP client for short-lived Verse docs tool calls.
- `verse_docs_status`, `verse_docs_search`, `verse_docs_search_api`, `verse_docs_get_chapter`, `verse_docs_get_api_module`, and `verse_docs_cache_all`.
- Human commands `/verse-docs:status`, `/verse-docs:search`, `/verse-docs:search-api`, and `/verse-docs:cache`.
- Python / install readiness checks, cache-dir reporting, and tool-result formatters with output truncation.
- Verse workflow skill guidance for using API search before writing non-trivial UEFN Verse code.

### Changed

- README now documents prerequisites, install paths, available tools, commands, cache environment variables, and MVP workflow.

## [0.1.2] - 2026-06-04

### Changed

- README and `docs/template-checklist.md` now follow the Pi OSS minimal-docs policy: `docs/` is optional, with explicit post-generation cleanup for template bootstrap docs.
- Template bootstrap docs (`github-template.md`, `repository-settings.md`, `typescript.md`) are labeled for delete-or-merge after setup.

## [0.1.1] - 2026-06-01

### Changed

- Publish workflow now supports npm publishing on merged package version bumps in addition to tags, releases, and manual dispatch.
- Publish workflow now installs a current npm CLI so npm Trusted Publishing OIDC is supported.
- CI and publish workflow commands no longer include literal trailing `\\n` text.

## [0.1.0] - YYYY-MM-DD

### Added

- Initial Pi package template.
- Example extension, Agent Skill, prompt, and theme.
- CI and npm Trusted Publishing workflow.
