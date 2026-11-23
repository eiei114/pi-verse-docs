import assert from "node:assert/strict";
import test from "node:test";

const { VERSE_MCP_UVX_SOURCE, getPathCommandCandidates, resolveVerseMcpCommand } = await import("../lib/verse-mcp-locator.ts");

test("getPathCommandCandidates expands Windows PATHEXT entries", () => {
  const candidates = getPathCommandCandidates("verse-mcp", "win32", {
    PATH: "C:\\Python312\\Scripts;C:\\tools",
    PATHEXT: ".EXE;.CMD",
  });

  assert.equal(candidates[0], "C:\\Python312\\Scripts\\verse-mcp");
  assert.equal(candidates[1], "C:\\Python312\\Scripts\\verse-mcp.exe");
  assert.equal(candidates[2], "C:\\Python312\\Scripts\\verse-mcp.cmd");
});

test("resolver prefers a PATH-installed verse-mcp executable", async () => {
  const status = await resolveVerseMcpCommand({
    platform: "win32",
    env: {
      PATH: "C:\\Python312\\Scripts;C:\\tools",
      PATHEXT: ".EXE;.CMD",
    },
    exists: async (path) => path === "C:\\Python312\\Scripts\\verse-mcp.exe",
  });

  assert.equal(status.found, true);
  assert.equal(status.mode, "path");
  assert.equal(status.command?.command, "C:\\Python312\\Scripts\\verse-mcp.exe");
  assert.deepEqual(status.command?.args, []);
});

test("resolver prefers verse-mcp in a padded, quoted Windows PATH entry over uvx", async () => {
  const installed = "C:\\Program Files\\Tools\\verse-mcp.exe";
  const uvx = "C:\\tools\\uvx.exe";
  const probes = [];
  const status = await resolveVerseMcpCommand({
    platform: "win32",
    env: {
      PATH: 'C:\\tools; "C:\\Program Files\\Tools" ',
      PATHEXT: ".EXE;.CMD",
    },
    exists: async (path) => {
      probes.push(path);
      return path === installed || path === uvx;
    },
  });

  assert.equal(status.mode, "path");
  assert.equal(status.command?.command, installed);
  assert.deepEqual(status.command?.args, []);
  assert.deepEqual(probes, [
    "C:\\tools\\verse-mcp",
    "C:\\tools\\verse-mcp.exe",
    "C:\\tools\\verse-mcp.cmd",
    "C:\\Program Files\\Tools\\verse-mcp",
    installed,
  ]);
});

test("resolver falls back to uvx when verse-mcp is absent", async () => {
  const status = await resolveVerseMcpCommand({
    platform: "darwin",
    env: {
      PATH: "/usr/local/bin:/opt/homebrew/bin",
    },
    exists: async (path) => path === "/opt/homebrew/bin/uvx",
  });

  assert.equal(status.found, true);
  assert.equal(status.mode, "uvx");
  assert.equal(status.command?.command, "/opt/homebrew/bin/uvx");
  assert.deepEqual(status.command?.args, ["--from", VERSE_MCP_UVX_SOURCE, "verse-mcp"]);
});

test("resolver reports install guidance when neither verse-mcp nor uvx exists", async () => {
  const status = await resolveVerseMcpCommand({
    platform: "linux",
    env: { PATH: "/usr/bin:/bin" },
    exists: async () => false,
  });

  assert.equal(status.found, false);
  assert.match(status.message, /Install verse-mcp or uv/i);
  assert.ok(status.checked.some((candidate) => candidate.endsWith("/verse-mcp")));
  assert.ok(status.checked.some((candidate) => candidate.endsWith("/uvx")));
});
