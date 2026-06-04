import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { formatCacheAllResult, formatMcpTextResult, VERSE_DOCS_DEFAULT_MAX_CHARS } from "./formatters.ts";
import { inspectVerseDocsStatus, formatVerseDocsStatus } from "./status.ts";
import { McpClientError, runOneShotMcpRequest, type OneShotMcpOptions, type OneShotMcpResult } from "./stdio-mcp-client.ts";
import { getVerseMcpCacheDir, resolveVerseMcpCommand, type VerseMcpCommand, type VerseMcpStatus } from "./verse-mcp-locator.ts";

export interface VerseDocsCallOptions {
  timeoutMs?: number;
  maxChars?: number;
  signal?: AbortSignal;
  resolveCommand?: () => Promise<VerseMcpStatus>;
  request?: (command: VerseMcpCommand, method: string, params?: unknown, options?: OneShotMcpOptions) => Promise<OneShotMcpResult>;
}

export interface VerseDocsToolResult {
  text: string;
  details: {
    command: string;
    result: unknown;
    stderr: string;
    cacheDir?: string;
    upstreamTool: string;
  };
}

function commandLine(command: VerseMcpCommand): string {
  return [command.command, ...command.args].join(" ");
}

async function requireVerseMcpCommand(resolveCommand?: () => Promise<VerseMcpStatus>): Promise<VerseMcpCommand> {
  const status = resolveCommand ? await resolveCommand() : await resolveVerseMcpCommand();
  if (status.command) return status.command;

  const summary = await inspectVerseDocsStatus({ verbose: true });
  throw new Error(formatVerseDocsStatus(summary, { verbose: true }));
}

function actionableMcpError(upstreamTool: string, error: unknown): Error {
  if (error instanceof McpClientError) {
    if (error.code === "timeout") {
      return new Error(`verse-mcp timed out while running ${upstreamTool}. Retry, increase timeoutMs, or warm the cache with verse_docs_cache_all.`);
    }

    if (error.code === "spawn_failed" || error.code === "process_exited") {
      return new Error(`Failed to run verse-mcp for ${upstreamTool}: ${error.message}`);
    }

    return new Error(`verse-mcp ${upstreamTool} failed: ${error.message}`);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function callVerseDocsTool(
  upstreamTool: string,
  args: Record<string, unknown>,
  options: VerseDocsCallOptions = {},
): Promise<VerseDocsToolResult> {
  const command = await requireVerseMcpCommand(options.resolveCommand);
  const request = options.request ?? runOneShotMcpRequest;

  try {
    const result = await request(
      command,
      "tools/call",
      { name: upstreamTool, arguments: args },
      {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      },
    );

    const cacheDir = upstreamTool === "cache_all_chapters" ? getVerseMcpCacheDir() : undefined;
    const text = upstreamTool === "cache_all_chapters"
      ? formatCacheAllResult(result.response.result, cacheDir!, options.maxChars ?? VERSE_DOCS_DEFAULT_MAX_CHARS)
      : formatMcpTextResult(result.response.result, options.maxChars ?? VERSE_DOCS_DEFAULT_MAX_CHARS);

    return {
      text,
      details: {
        command: commandLine(command),
        result: result.response.result,
        stderr: result.stderr,
        cacheDir,
        upstreamTool,
      },
    };
  } catch (error) {
    throw actionableMcpError(upstreamTool, error);
  }
}

export async function promptForQuery(ctx: ExtensionContext, title: string, placeholder: string, args: string): Promise<string | undefined> {
  const trimmedArgs = args.trim();
  if (trimmedArgs) return trimmedArgs;

  const entered = await ctx.ui.input(title, placeholder);
  const query = String(entered ?? "").trim();
  return query || undefined;
}
