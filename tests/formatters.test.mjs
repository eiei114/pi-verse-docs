import assert from "node:assert/strict";
import test from "node:test";

const { formatCacheAllResult, formatMcpTextResult } = await import("../lib/formatters.ts");

test("formatMcpTextResult passes strings through", () => {
  assert.equal(formatMcpTextResult("Verse documentation"), "Verse documentation");
});

test("formatMcpTextResult truncates only when the input exceeds maxChars", () => {
  assert.equal(formatMcpTextResult("abcde", 5), "abcde");
  assert.equal(formatMcpTextResult("abcdef", 5), "abcde\n\n[truncated 1 chars]");
});

test("formatMcpTextResult joins text content and serializes other items", () => {
  const result = {
    content: [
      { type: "text", text: "first" },
      { type: "text", text: "second" },
      { type: "image", data: "encoded" },
      { type: "text", text: 123 },
      null,
      undefined,
      false,
      42,
    ],
  };

  assert.equal(
    formatMcpTextResult(result),
    [
      "first",
      "second",
      '{\n  "type": "image",\n  "data": "encoded"\n}',
      '{\n  "type": "text",\n  "text": 123\n}',
      "null",
      "undefined",
      "false",
      "42",
    ].join("\n"),
  );
});

test("formatMcpTextResult uses JSON fallback for missing or non-array content", () => {
  assert.equal(formatMcpTextResult({ result: "fallback" }), '{\n  "result": "fallback"\n}');
  assert.equal(formatMcpTextResult({ content: "not an array" }), '{\n  "content": "not an array"\n}');
});

test("formatMcpTextResult handles null and numeric results", () => {
  assert.equal(formatMcpTextResult(null), "null");
  assert.equal(formatMcpTextResult(42), "42");
});

test("formatCacheAllResult appends the cache directory after the formatted body", () => {
  assert.equal(
    formatCacheAllResult("cached result", "/cache/verse-mcp"),
    "cached result\n\nCache dir: /cache/verse-mcp",
  );
});

test("formatCacheAllResult truncates the body before appending the cache directory", () => {
  assert.equal(
    formatCacheAllResult("abcdef", "/cache/verse-mcp", 3),
    "abc\n\n[truncated 3 chars]\n\nCache dir: /cache/verse-mcp",
  );
});
