import assert from "node:assert/strict";
import test from "node:test";

const { callVerseDocsTool } = await import("../lib/verse-docs.ts");

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
  if (message.id !== undefined) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  }
});
`;

const fakeCommand = { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" };

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

test("callVerseDocsTool maps MCP errors to actionable text", async () => {
  await assert.rejects(
    () =>
      callVerseDocsTool("missing_tool", {}, {
        resolveCommand: async () => ({ supported: true, platform: process.platform, found: true, command: fakeCommand, checked: [], message: "ok" }),
      }),
    /verse-mcp missing_tool failed: MCP error -32601: Method not found/,
  );
});
