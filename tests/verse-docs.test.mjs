import assert from "node:assert/strict";
import test from "node:test";

const { callVerseDocsTool } = await import("../lib/verse-docs.ts");
const { McpClientError } = await import("../lib/stdio-mcp-client.ts");

const fakeServer = String.raw`
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fake", version: "0.0.0" } } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "search_verse_docs") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "Search results for 'decides':\n## Chapter: failure\n\ndecides example" }] } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "cache_all_chapters") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "Cached 21/21 pages." }] } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "list_chapters") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "failure\nconcurrency\nclasses-interfaces" }] } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "list_verse_api_modules") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "creative_device\nfort_character" }] } }));
    return;
  }
  if (message.id !== undefined) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  }
});
`;

const fakeCommand = { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" };
const resolveFakeCommand = async () => ({
  supported: true,
  platform: process.platform,
  found: true,
  command: fakeCommand,
  checked: [],
  message: "ok",
});

async function assertInjectedMcpErrorMapping(code, message, expectedMessage) {
  let resolverCalls = 0;
  let requestCalls = 0;

  await assert.rejects(
    () =>
      callVerseDocsTool("search_verse_docs", { query: "decides" }, {
        resolveCommand: async () => {
          resolverCalls += 1;
          return resolveFakeCommand();
        },
        request: async (command, method, params) => {
          requestCalls += 1;
          assert.equal(command, fakeCommand);
          assert.equal(method, "tools/call");
          assert.deepEqual(params, { name: "search_verse_docs", arguments: { query: "decides" } });
          throw new McpClientError(code, message);
        },
      }),
    (error) => {
      assert.equal(error.message, expectedMessage);
      return true;
    },
  );

  assert.equal(resolverCalls, 1);
  assert.equal(requestCalls, 1);
}

test("callVerseDocsTool formats a search result through tools/call", async () => {
  const result = await callVerseDocsTool("search_verse_docs", { query: "decides" }, {
    resolveCommand: async () => ({ supported: true, platform: process.platform, found: true, command: fakeCommand, checked: [], message: "ok" }),
  });

  assert.match(result.text, /Search results for 'decides'/);
  assert.equal(result.details.upstreamTool, "search_verse_docs");
  assert.match(result.details.command, /node|exe/i);
});

test("callVerseDocsTool appends cache dir for cache_all_chapters", async () => {
  const result = await callVerseDocsTool("cache_all_chapters", {}, {
    resolveCommand: async () => ({ supported: true, platform: process.platform, found: true, command: fakeCommand, checked: [], message: "ok" }),
  });

  assert.match(result.text, /Cached 21\/21 pages\./);
  assert.match(result.text, /Cache dir:/);
  assert.ok(result.details.cacheDir);
});

test("callVerseDocsTool formats list_chapters through tools/call", async () => {
  const result = await callVerseDocsTool("list_chapters", {}, {
    resolveCommand: async () => ({ supported: true, platform: process.platform, found: true, command: fakeCommand, checked: [], message: "ok" }),
  });

  assert.match(result.text, /failure/);
  assert.equal(result.details.upstreamTool, "list_chapters");
});

test("callVerseDocsTool formats list_verse_api_modules through tools/call", async () => {
  const result = await callVerseDocsTool("list_verse_api_modules", {}, {
    resolveCommand: async () => ({ supported: true, platform: process.platform, found: true, command: fakeCommand, checked: [], message: "ok" }),
  });

  assert.match(result.text, /creative_device/);
  assert.equal(result.details.upstreamTool, "list_verse_api_modules");
});

test("callVerseDocsTool maps MCP errors to actionable text", async () => {
  await assert.rejects(
    () =>
      callVerseDocsTool("missing_tool", {}, {
        resolveCommand: async () => ({ supported: true, platform: process.platform, found: true, command: fakeCommand, checked: [], message: "ok" }),
      }),
    /verse-mcp missing_tool failed: MCP error -32601: Method not found/,
  );
});

test("callVerseDocsTool gives retry guidance when verse-mcp times out", async () => {
  await assertInjectedMcpErrorMapping(
    "timeout",
    "Timed out waiting for MCP tools/call after 1000ms",
    "verse-mcp timed out while running search_verse_docs. Retry, increase timeoutMs, or warm the cache with verse_docs_cache_all.",
  );
});

test("callVerseDocsTool reports when verse-mcp fails to start", async () => {
  await assertInjectedMcpErrorMapping(
    "spawn_failed",
    "Failed to start MCP process: spawn uvx ENOENT",
    "Failed to run verse-mcp for search_verse_docs: Failed to start MCP process: spawn uvx ENOENT",
  );
});

test("callVerseDocsTool reports when verse-mcp exits before responding", async () => {
  await assertInjectedMcpErrorMapping(
    "process_exited",
    "MCP process exited before responding",
    "Failed to run verse-mcp for search_verse_docs: MCP process exited before responding",
  );
});
