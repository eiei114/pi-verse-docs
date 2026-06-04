import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { probePythonRuntime, type PythonStatus } from "./python-runtime.ts";
import { runOneShotMcpRequest, type McpClientError } from "./stdio-mcp-client.ts";
import { getVerseMcpCacheDir, resolveVerseMcpCommand, type VerseMcpStatus } from "./verse-mcp-locator.ts";

export interface VerseDocsStatusOptions {
  ping?: boolean;
  verbose?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface VerseDocsStatusSummary {
  ready: boolean;
  python: PythonStatus;
  verseMcp: VerseMcpStatus;
  cacheDir: string;
  ping?: {
    ok: boolean;
    toolCount?: number;
    stderr?: string;
    error?: { code: string; message: string; details?: Record<string, unknown> };
  };
  installHints: string[];
}

function formatCommand(command?: { command: string; args: string[] }): string | undefined {
  if (!command) return undefined;
  return [command.command, ...command.args].join(" ");
}

function getInstallHints(python: PythonStatus, verseMcp: VerseMcpStatus): string[] {
  const hints: string[] = [];

  if ((!python.found || !python.supported) && verseMcp.mode !== "uvx") {
    hints.push("Install Python 3.10+: https://www.python.org/downloads/");
  }

  if (!verseMcp.found) {
    hints.push("Install verse-mcp with pip: pip install git+https://github.com/BurgersJackson/verse-mcp.git");
    hints.push("Or use uvx on demand: uvx --from git+https://github.com/BurgersJackson/verse-mcp verse-mcp");
  }

  return hints;
}

function countTools(result: unknown): number | undefined {
  if (typeof result !== "object" || result === null || !("tools" in result) || !Array.isArray(result.tools)) {
    return undefined;
  }

  return result.tools.length;
}

function formatPingError(error: unknown): { code: string; message: string; details?: Record<string, unknown> } {
  if (error instanceof Error && "code" in error) {
    const mcpError = error as McpClientError & { details?: Record<string, unknown> };
    return {
      code: typeof mcpError.code === "string" ? mcpError.code : "error",
      message: mcpError.message,
      details: mcpError.details,
    };
  }

  if (error instanceof Error) {
    return { code: "error", message: error.message };
  }

  return { code: "error", message: String(error) };
}

export async function inspectVerseDocsStatus(options: VerseDocsStatusOptions = {}): Promise<VerseDocsStatusSummary> {
  const python = await probePythonRuntime();
  const verseMcp = await resolveVerseMcpCommand();
  const installHints = getInstallHints(python, verseMcp);
  const cacheDir = getVerseMcpCacheDir();

  const summary: VerseDocsStatusSummary = {
    ready: verseMcp.found,
    python,
    verseMcp,
    cacheDir,
    installHints,
  };

  if (options.ping && verseMcp.command && python.supported) {
    try {
      const result = await runOneShotMcpRequest(verseMcp.command, "tools/list", undefined, {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      });

      summary.ping = {
        ok: true,
        toolCount: countTools(result.response.result),
        stderr: result.stderr || undefined,
      };
      summary.ready = true;
    } catch (error) {
      summary.ping = {
        ok: false,
        error: formatPingError(error),
      };
      summary.ready = false;
    }
  }

  return summary;
}

export function formatVerseDocsStatus(summary: VerseDocsStatusSummary, options: { verbose?: boolean } = {}): string {
  const lines = [
    summary.ready ? "pi-verse-docs status: ready" : "pi-verse-docs status: setup needed",
    `python: ${summary.python.message}`,
    `verse-mcp: ${summary.verseMcp.message}`,
  ];

  if (summary.python.version) lines.push(`python_version: ${summary.python.version}`);

  const resolvedPython = formatCommand(summary.python.command);
  if (resolvedPython) lines.push(`python_command: ${resolvedPython}`);

  const resolvedVerseMcp = formatCommand(summary.verseMcp.command);
  if (resolvedVerseMcp) lines.push(`verse_mcp_command: ${resolvedVerseMcp}`);
  lines.push(`cache_dir: ${summary.cacheDir}`);

  if (summary.ping) {
    lines.push(summary.ping.ok ? `mcp_ping: ok${summary.ping.toolCount !== undefined ? ` (${summary.ping.toolCount} tools)` : ""}` : `mcp_ping: failed — ${summary.ping.error?.message ?? "unknown error"}`);
  }

  if (summary.installHints.length > 0) {
    lines.push("install_hints:");
    for (const hint of summary.installHints) lines.push(`- ${hint}`);
  }

  if (options.verbose) {
    if (summary.python.checked.length > 0) {
      lines.push("python_checked:");
      for (const candidate of summary.python.checked) lines.push(`- ${candidate}`);
    }

    if (summary.verseMcp.checked.length > 0) {
      lines.push("verse_mcp_checked:");
      for (const candidate of summary.verseMcp.checked) lines.push(`- ${candidate}`);
    }
  }

  return lines.join("\n");
}

export function statusNotificationLevel(summary: VerseDocsStatusSummary): "info" | "warning" {
  return summary.ready ? "info" : "warning";
}

export async function notifyVerseDocsStatus(ctx: ExtensionContext, options: VerseDocsStatusOptions = {}): Promise<VerseDocsStatusSummary> {
  const summary = await inspectVerseDocsStatus({ ...options, signal: options.signal ?? ctx.signal });
  ctx.ui.notify(formatVerseDocsStatus(summary, { verbose: options.verbose }), statusNotificationLevel(summary));
  return summary;
}
