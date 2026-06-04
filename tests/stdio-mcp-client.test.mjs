import assert from "node:assert/strict";
import test from "node:test";

const { McpClientError, runOneShotMcpRequest, runOneShotMcpRequests } = await import("../lib/stdio-mcp-client.ts");

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
  if (message.method === "tools/list") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "search_verse_docs", description: "Search Verse docs" }] } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "search_verse_docs") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "docs=" + message.params.arguments.query }] } }));
    return;
  }
  if (message.method === "tools/call" && message.params?.name === "search_verse_api") {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "api=" + message.params.arguments.query }] } }));
    return;
  }
  if (message.id !== undefined) {
    console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  }
});
`;

test("runOneShotMcpRequest initializes, calls one method, and returns the result", async () => {
  const result = await runOneShotMcpRequest(
    { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" },
    "tools/list",
    undefined,
    { timeoutMs: 2000 },
  );

  assert.deepEqual(result.response.result, { tools: [{ name: "search_verse_docs", description: "Search Verse docs" }] });
});

test("runOneShotMcpRequests supports multiple requests in one process", async () => {
  const result = await runOneShotMcpRequests(
    { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" },
    [
      { method: "tools/call", params: { name: "search_verse_docs", arguments: { query: "array" } } },
      { method: "tools/call", params: { name: "search_verse_api", arguments: { query: "creative_device" } } },
    ],
    { timeoutMs: 2000 },
  );

  assert.equal(result.responses.length, 2);
  assert.deepEqual(result.responses[0].result, { content: [{ type: "text", text: "docs=array" }] });
  assert.deepEqual(result.responses[1].result, { content: [{ type: "text", text: "api=creative_device" }] });
});

test("runOneShotMcpRequest leaves no child process running after completion", async () => {
  let child;

  await runOneShotMcpRequest(
    { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" },
    "tools/list",
    undefined,
    {
      timeoutMs: 2000,
      onProcess: (processChild) => {
        child = processChild;
      },
    },
  );

  assert.ok(child);
  assert.notEqual(child.exitCode, null);
});

test("runOneShotMcpRequest surfaces structured MCP errors", async () => {
  await assert.rejects(
    () =>
      runOneShotMcpRequest(
        { command: process.execPath, args: ["-e", fakeServer], source: "node fake server" },
        "missing/method",
        undefined,
        { timeoutMs: 2000 },
      ),
    (error) => {
      assert.ok(error instanceof McpClientError);
      assert.equal(error.code, "mcp_error");
      assert.equal(error.details.method, "missing/method");
      assert.match(error.message, /Method not found/);
      return true;
    },
  );
});
