import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { basename } from "node:path";
import type { VerseMcpCommand } from "./verse-mcp-locator.ts";

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcFailure;

export interface OneShotMcpOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  clientInfo?: { name: string; version: string };
  onProcess?: (child: ChildProcessWithoutNullStreams) => void;
  onProcessExit?: (child: ChildProcessWithoutNullStreams) => void;
}

export interface OneShotMcpCall {
  method: string;
  params?: unknown;
}

export interface OneShotMcpResult<T = unknown> {
  response: JsonRpcSuccess<T>;
  stderr: string;
}

export interface OneShotMcpSequenceResult {
  responses: JsonRpcSuccess[];
  stderr: string;
}

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void;
  reject: (error: Error) => void;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MCP_PROTOCOL_VERSION = "2024-11-05";
const DEFAULT_CLIENT_INFO = { name: "pi-verse-docs", version: "0.2.0" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function truncate(value: string, maxChars = 20_000): string {
  if (value.length <= maxChars) return value;
  return value.slice(-maxChars);
}

function makeSpawnCommand(command: VerseMcpCommand): { command: string; args: string[] } {
  if (process.platform !== "win32") return command;

  const fileName = basename(command.command).toLowerCase();
  if (!fileName.endsWith(".bat") && !fileName.endsWith(".cmd")) return command;

  return { command: "cmd.exe", args: ["/c", command.command, ...command.args] };
}

function writeMessage(child: ChildProcessWithoutNullStreams, message: unknown): void {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

export class McpClientError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "McpClientError";
    this.code = code;
    this.details = details;
  }
}

function asMcpError(error: unknown, fallbackCode = "unknown_error"): McpClientError {
  if (error instanceof McpClientError) return error;
  if (error instanceof Error) return new McpClientError(fallbackCode, error.message);
  return new McpClientError(fallbackCode, String(error));
}

function formatJsonRpcError(method: string, response: JsonRpcFailure): McpClientError {
  return new McpClientError("mcp_error", `MCP error ${response.error.code}: ${response.error.message}`, {
    method,
    rpcError: response.error,
  });
}

export async function runOneShotMcpRequest<T = unknown>(
  command: VerseMcpCommand,
  method: string,
  params?: unknown,
  options: OneShotMcpOptions = {},
): Promise<OneShotMcpResult<T>> {
  const result = await runOneShotMcpRequests(command, [{ method, params }], options);
  const response = result.responses.at(-1);

  if (!response) {
    throw new McpClientError("empty_response", "MCP sequence completed without a response", { method });
  }

  return { response: response as JsonRpcSuccess<T>, stderr: result.stderr };
}

export async function runOneShotMcpRequests(
  command: VerseMcpCommand,
  calls: OneShotMcpCall[],
  options: OneShotMcpOptions = {},
): Promise<OneShotMcpSequenceResult> {
  if (calls.length === 0) {
    throw new McpClientError("invalid_request", "At least one MCP request is required");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const spawnCommand = makeSpawnCommand(command);
  const child = spawn(spawnCommand.command, spawnCommand.args, {
    stdio: "pipe",
    windowsHide: true,
  });

  options.onProcess?.(child);

  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";
  let finalized = false;
  const pending = new Map<number, PendingRequest>();

  const failAll = (error: Error): void => {
    const structured = asMcpError(error);
    for (const request of pending.values()) request.reject(structured);
    pending.clear();
  };

  const cleanup = async (): Promise<void> => {
    if (finalized) return;
    finalized = true;

    options.onProcessExit?.(child);
    child.stdin.end();

    if (child.exitCode !== null || child.killed) return;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (child.exitCode === null && !child.killed) child.kill();
        resolve();
      }, 250);

      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  };

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf8");

    while (true) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) break;

      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (!line) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        failAll(new McpClientError("invalid_json", "MCP server returned invalid JSON", { line }));
        continue;
      }

      if (!isRecord(parsed) || typeof parsed.id !== "number") continue;

      const request = pending.get(parsed.id);
      if (!request) continue;

      pending.delete(parsed.id);
      request.resolve(parsed as unknown as JsonRpcResponse);
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderr = truncate(`${stderr}${chunk.toString("utf8")}`);
  });

  child.on("error", (error) => {
    failAll(
      new McpClientError("spawn_failed", `Failed to start MCP process: ${error.message}`, {
        command: spawnCommand.command,
        args: spawnCommand.args,
      }),
    );
  });

  child.on("exit", (code, signal) => {
    if (pending.size > 0) {
      failAll(
        new McpClientError("process_exited", "MCP process exited before responding", {
          code,
          signal,
          stderr,
        }),
      );
    }
  });

  const abort = (): void => {
    failAll(new McpClientError("aborted", "MCP request aborted"));
    if (child.exitCode === null && !child.killed) child.kill();
  };

  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });

  const sendRequest = async <R = unknown>(requestMethod: string, requestParams?: unknown): Promise<JsonRpcSuccess<R>> => {
    const id = nextId++;

    const responsePromise = new Promise<JsonRpcResponse<R>>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (response: JsonRpcResponse) => void, reject });
    });

    writeMessage(child, { jsonrpc: "2.0", id, method: requestMethod, params: requestParams });

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new McpClientError("timeout", `Timed out waiting for MCP ${requestMethod} after ${timeoutMs}ms`, {
            method: requestMethod,
            timeoutMs,
          }),
        );
      }, timeoutMs);

      responsePromise.finally(() => clearTimeout(timer)).catch(() => clearTimeout(timer));
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);
    if ("error" in response) throw formatJsonRpcError(requestMethod, response);
    return response;
  };

  try {
    await sendRequest("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: options.clientInfo ?? DEFAULT_CLIENT_INFO,
    });

    writeMessage(child, { jsonrpc: "2.0", method: "notifications/initialized" });

    const responses: JsonRpcSuccess[] = [];
    for (const call of calls) {
      responses.push(await sendRequest(call.method, call.params));
    }

    return { responses, stderr };
  } catch (error) {
    throw asMcpError(error);
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await cleanup();
  }
}

export class McpProcessRegistry {
  private readonly children = new Set<ChildProcessWithoutNullStreams>();

  track(child: ChildProcessWithoutNullStreams): void {
    this.children.add(child);
  }

  untrack(child: ChildProcessWithoutNullStreams): void {
    this.children.delete(child);
  }

  killAll(): void {
    for (const child of this.children) {
      if (child.exitCode === null && !child.killed) child.kill();
    }
    this.children.clear();
  }
}
