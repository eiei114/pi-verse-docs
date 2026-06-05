import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { VERSE_DOCS_DEFAULT_MAX_CHARS } from "../lib/formatters.ts";
import { formatVerseDocsStatus, inspectVerseDocsStatus, notifyVerseDocsStatus } from "../lib/status.ts";
import { callVerseDocsTool, promptForQuery } from "../lib/verse-docs.ts";

const statusParameters = Type.Object({
  ping: Type.Optional(Type.Boolean({ description: "If true, run a lightweight tools/list MCP ping after locating verse-mcp." })),
  verbose: Type.Optional(Type.Boolean({ description: "Include all checked candidate paths." })),
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for an optional MCP ping. Default: 10000." })),
});

const searchParameters = Type.Object({
  query: Type.String({ description: "Search query for Verse language docs." }),
  maxChars: Type.Optional(Type.Number({ description: `Maximum output characters. Default: ${VERSE_DOCS_DEFAULT_MAX_CHARS}.` })),
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for verse-mcp. Default: 30000." })),
});

const searchApiParameters = Type.Object({
  query: Type.String({ description: "Search query for Verse / UEFN API digest entries." }),
  maxChars: Type.Optional(Type.Number({ description: `Maximum output characters. Default: ${VERSE_DOCS_DEFAULT_MAX_CHARS}.` })),
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for verse-mcp. Default: 30000." })),
});

const getChapterParameters = Type.Object({
  chapterName: Type.String({ description: "Verse chapter name or slug, e.g. failure, concurrency, classes-interfaces." }),
  maxChars: Type.Optional(Type.Number({ description: `Maximum output characters. Default: ${VERSE_DOCS_DEFAULT_MAX_CHARS}.` })),
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for verse-mcp. Default: 30000." })),
});

const getApiModuleParameters = Type.Object({
  moduleName: Type.String({ description: "Verse API module or class name, e.g. creative_device or fort_character." }),
  maxChars: Type.Optional(Type.Number({ description: `Maximum output characters. Default: ${VERSE_DOCS_DEFAULT_MAX_CHARS}.` })),
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for verse-mcp. Default: 30000." })),
});

const cacheAllParameters = Type.Object({
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for cache warm-up. Default: 120000." })),
});

const listParameters = Type.Object({
  maxChars: Type.Optional(Type.Number({ description: `Maximum output characters. Default: ${VERSE_DOCS_DEFAULT_MAX_CHARS}.` })),
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum milliseconds to wait for verse-mcp. Default: 30000." })),
});

async function runVerseTool(
  upstreamTool: string,
  args: Record<string, unknown>,
  options: { timeoutMs?: number; maxChars?: number; signal?: AbortSignal },
) {
  return await callVerseDocsTool(upstreamTool, args, {
    timeoutMs: options.timeoutMs,
    maxChars: options.maxChars,
    signal: options.signal,
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("verse-docs:status", {
    description: "Show Python / verse-mcp installation status for pi-verse-docs",
    handler: async (_args, ctx) => {
      await notifyVerseDocsStatus(ctx, { verbose: true });
    },
  });

  pi.registerCommand("verse-docs:search", {
    description: "Search Verse language docs via verse-mcp",
    handler: async (args, ctx) => {
      const query = await promptForQuery(ctx, "Search Verse docs:", "e.g. option type, decides, concurrency", args);
      if (!query) {
        ctx.ui.notify("Search cancelled. Enter a Verse docs query.", "warning");
        return;
      }

      try {
        const result = await runVerseTool("search_verse_docs", { query }, { timeoutMs: 30_000, signal: ctx.signal });
        ctx.ui.notify(result.text, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("verse-docs:search-api", {
    description: "Search Verse / UEFN API docs via verse-mcp",
    handler: async (args, ctx) => {
      const query = await promptForQuery(ctx, "Search Verse API:", "e.g. creative_device, fort_character", args);
      if (!query) {
        ctx.ui.notify("Search cancelled. Enter a Verse API query.", "warning");
        return;
      }

      try {
        const result = await runVerseTool("search_verse_api", { query }, { timeoutMs: 30_000, signal: ctx.signal });
        ctx.ui.notify(result.text, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("verse-docs:cache", {
    description: "Pre-download Verse docs chapters for faster future searches",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Caching Verse docs. This may take a few minutes on first run.", "info");

      try {
        const result = await runVerseTool("cache_all_chapters", {}, { timeoutMs: 120_000, signal: ctx.signal });
        ctx.ui.notify(result.text, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("verse-docs:list-chapters", {
    description: "List Verse language book chapters via verse-mcp",
    handler: async (_args, ctx) => {
      try {
        const result = await runVerseTool("list_chapters", {}, { timeoutMs: 30_000, signal: ctx.signal });
        ctx.ui.notify(result.text, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("verse-docs:list-api-modules", {
    description: "List Verse / UEFN API digest modules via verse-mcp",
    handler: async (_args, ctx) => {
      try {
        const result = await runVerseTool("list_verse_api_modules", {}, { timeoutMs: 30_000, signal: ctx.signal });
        ctx.ui.notify(result.text, "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerTool({
    name: "verse_docs_status",
    label: "Verse Docs Status",
    description: "Report Python, verse-mcp, and cache readiness for pi-verse-docs. Optional MCP ping supported.",
    promptSnippet: "verse_docs_status: inspect Python, verse-mcp, and cache readiness before relying on Verse docs tools",
    promptGuidelines: [
      "Use this tool to verify bootstrap state before relying on Verse docs tools.",
    ],
    parameters: statusParameters,
    async execute(_toolCallId, params, signal) {
      const summary = await inspectVerseDocsStatus({
        ping: params.ping ?? false,
        verbose: params.verbose ?? false,
        timeoutMs: params.timeoutMs,
        signal,
      });

      return {
        content: [{ type: "text", text: formatVerseDocsStatus(summary, { verbose: params.verbose ?? false }) }],
        details: summary,
      };
    },
  });

  pi.registerTool({
    name: "verse_docs_search",
    label: "Verse Docs Search",
    description: `Search Verse language docs via verse-mcp. Output is truncated to maxChars (default ${VERSE_DOCS_DEFAULT_MAX_CHARS}).`,
    promptSnippet: "verse_docs_search: search Verse language docs for syntax, semantics, and language patterns",
    promptGuidelines: [
      "Use verse_docs_search for Verse language concepts like decides, failure contexts, concurrency, effects, and module syntax.",
      "For UEFN classes, devices, and methods, use verse_docs_search_api instead of guessing API names.",
    ],
    parameters: searchParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runVerseTool("search_verse_docs", { query: params.query }, { timeoutMs: params.timeoutMs ?? 30_000, maxChars: params.maxChars, signal });
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });

  pi.registerTool({
    name: "verse_docs_search_api",
    label: "Verse Docs Search API",
    description: `Search the Verse / UEFN API digest via verse-mcp. Output is truncated to maxChars (default ${VERSE_DOCS_DEFAULT_MAX_CHARS}).`,
    promptSnippet: "verse_docs_search_api: search the Verse / UEFN API digest for devices, classes, methods, and modules",
    promptGuidelines: [
      "Use verse_docs_search_api before writing non-trivial UEFN Verse code so class names and method signatures are verified.",
      "Do not guess device or API names when verse_docs_search_api can confirm them.",
    ],
    parameters: searchApiParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runVerseTool("search_verse_api", { query: params.query }, { timeoutMs: params.timeoutMs ?? 30_000, maxChars: params.maxChars, signal });
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });

  pi.registerTool({
    name: "verse_docs_get_chapter",
    label: "Verse Docs Get Chapter",
    description: `Get a full Verse language chapter by name or slug. Output is truncated to maxChars (default ${VERSE_DOCS_DEFAULT_MAX_CHARS}).`,
    promptSnippet: "verse_docs_get_chapter: fetch a full Verse language chapter by name when search results need deeper reading",
    promptGuidelines: [
      "Use verse_docs_get_chapter after verse_docs_search when you need the full chapter context for a specific concept.",
    ],
    parameters: getChapterParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runVerseTool("get_chapter", { chapter_name: params.chapterName }, { timeoutMs: params.timeoutMs ?? 30_000, maxChars: params.maxChars, signal });
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });

  pi.registerTool({
    name: "verse_docs_get_api_module",
    label: "Verse Docs Get API Module",
    description: `Get a full Verse / UEFN API module or class section. Output is truncated to maxChars (default ${VERSE_DOCS_DEFAULT_MAX_CHARS}).`,
    promptSnippet: "verse_docs_get_api_module: fetch the full Verse / UEFN API section for a module or class after search results",
    promptGuidelines: [
      "Use verse_docs_get_api_module after verse_docs_search_api when you need the full digest section for one module or class.",
    ],
    parameters: getApiModuleParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runVerseTool("get_verse_api_module", { module_name: params.moduleName }, { timeoutMs: params.timeoutMs ?? 30_000, maxChars: params.maxChars, signal });
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });

  pi.registerTool({
    name: "verse_docs_list_chapters",
    label: "Verse Docs List Chapters",
    description: `List Verse language book chapters via verse-mcp. Output is truncated to maxChars (default ${VERSE_DOCS_DEFAULT_MAX_CHARS}).`,
    promptSnippet: "verse_docs_list_chapters: enumerate valid Verse language chapter names before calling verse_docs_get_chapter",
    promptGuidelines: [
      "Use verse_docs_list_chapters when you need valid chapter names or slugs before calling verse_docs_get_chapter.",
    ],
    parameters: listParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runVerseTool("list_chapters", {}, { timeoutMs: params.timeoutMs ?? 30_000, maxChars: params.maxChars, signal });
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });

  pi.registerTool({
    name: "verse_docs_list_api_modules",
    label: "Verse Docs List API Modules",
    description: `List Verse / UEFN API digest modules via verse-mcp. Output is truncated to maxChars (default ${VERSE_DOCS_DEFAULT_MAX_CHARS}).`,
    promptSnippet: "verse_docs_list_api_modules: enumerate valid API module or class names before calling verse_docs_get_api_module",
    promptGuidelines: [
      "Use verse_docs_list_api_modules when you need valid module or class names before calling verse_docs_get_api_module.",
    ],
    parameters: listParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runVerseTool("list_verse_api_modules", {}, { timeoutMs: params.timeoutMs ?? 30_000, maxChars: params.maxChars, signal });
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });

  pi.registerTool({
    name: "verse_docs_cache_all",
    label: "Verse Docs Cache All",
    description: "Pre-download Verse chapters through verse-mcp for faster future searches. Network required on first warm-up.",
    promptSnippet: "verse_docs_cache_all: warm the local Verse docs cache for faster future searches",
    promptGuidelines: [
      "Use verse_docs_cache_all early in a Verse session when repeated docs searches are likely.",
      "Caching can take a while on first run; surface timeouts and retry guidance clearly.",
    ],
    parameters: cacheAllParameters,
    async execute(_toolCallId, params, signal) {
      const result = await runVerseTool("cache_all_chapters", {}, { timeoutMs: params.timeoutMs ?? 120_000, signal });
      return {
        content: [{ type: "text", text: result.text }],
        details: result.details,
      };
    },
  });
}
