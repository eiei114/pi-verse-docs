import assert from "node:assert/strict";
import test from "node:test";

const { formatVerseDocsStatus, statusNotificationLevel } = await import("../lib/status.ts");

function createStatusSummary(overrides = {}) {
  return {
    ready: true,
    python: {
      supported: true,
      platform: "linux",
      found: true,
      version: "3.12.1",
      command: { command: "/usr/bin/python3", args: ["-3"], source: "PATH:python3" },
      checked: ["/usr/bin/python3", "/usr/local/bin/python3"],
      message: "Found Python 3.12.1 at /usr/bin/python3",
    },
    verseMcp: {
      supported: true,
      platform: "linux",
      found: true,
      mode: "path",
      command: { command: "/usr/local/bin/verse-mcp", args: [], source: "PATH:verse-mcp" },
      checked: ["/usr/local/bin/verse-mcp"],
      message: "Found verse-mcp on PATH at /usr/local/bin/verse-mcp",
    },
    cacheDir: "/cache/verse-mcp",
    installHints: [],
    ...overrides,
  };
}

test("formatVerseDocsStatus formats a ready summary and optional runtime details", () => {
  const summary = createStatusSummary();

  assert.equal(
    formatVerseDocsStatus(summary),
    [
      "pi-verse-docs status: ready",
      "python: Found Python 3.12.1 at /usr/bin/python3",
      "verse-mcp: Found verse-mcp on PATH at /usr/local/bin/verse-mcp",
      "python_version: 3.12.1",
      "python_command: /usr/bin/python3 -3",
      "verse_mcp_command: /usr/local/bin/verse-mcp",
      "cache_dir: /cache/verse-mcp",
    ].join("\n"),
  );
  assert.equal(statusNotificationLevel(summary), "info");
});

test("formatVerseDocsStatus formats setup-needed status with install hints", () => {
  const summary = createStatusSummary({
    ready: false,
    python: {
      supported: false,
      platform: "linux",
      found: false,
      checked: [],
      message: "Python 3.10+ was not found on PATH.",
    },
    verseMcp: {
      supported: true,
      platform: "linux",
      found: false,
      checked: [],
      message: "verse-mcp was not found on PATH, and uvx fallback is unavailable.",
    },
    installHints: [
      "Install Python 3.10+: https://www.python.org/downloads/",
      "Install verse-mcp with pip: pip install git+https://github.com/BurgersJackson/verse-mcp.git",
      "Or use uvx on demand: uvx --from git+https://github.com/BurgersJackson/verse-mcp verse-mcp",
    ],
  });

  assert.equal(
    formatVerseDocsStatus(summary),
    [
      "pi-verse-docs status: setup needed",
      "python: Python 3.10+ was not found on PATH.",
      "verse-mcp: verse-mcp was not found on PATH, and uvx fallback is unavailable.",
      "cache_dir: /cache/verse-mcp",
      "install_hints:",
      "- Install Python 3.10+: https://www.python.org/downloads/",
      "- Install verse-mcp with pip: pip install git+https://github.com/BurgersJackson/verse-mcp.git",
      "- Or use uvx on demand: uvx --from git+https://github.com/BurgersJackson/verse-mcp verse-mcp",
    ].join("\n"),
  );
  assert.equal(statusNotificationLevel(summary), "warning");
});

test("formatVerseDocsStatus reports successful ping with tool count or without it", () => {
  const withToolCount = formatVerseDocsStatus(createStatusSummary({ ping: { ok: true, toolCount: 7 } }));

  assert.match(withToolCount, /mcp_ping: ok \(7 tools\)/);
  assert.ok(formatVerseDocsStatus(createStatusSummary({ ping: { ok: true } })).endsWith("mcp_ping: ok"));
});

test("formatVerseDocsStatus includes an MCP ping failure message", () => {
  const output = formatVerseDocsStatus(
    createStatusSummary({ ping: { ok: false, error: { code: "timeout", message: "server did not respond" } } }),
  );

  assert.match(output, /mcp_ping: failed — server did not respond/);
});

test("formatVerseDocsStatus only lists checked candidates in verbose mode", () => {
  const summary = createStatusSummary();
  const concise = formatVerseDocsStatus(summary, { verbose: false });
  const verbose = formatVerseDocsStatus(summary, { verbose: true });

  assert.doesNotMatch(concise, /python_checked:|verse_mcp_checked:/);
  assert.ok(
    verbose.includes(
      [
        "python_checked:",
        "- /usr/bin/python3",
        "- /usr/local/bin/python3",
        "verse_mcp_checked:",
        "- /usr/local/bin/verse-mcp",
      ].join("\n"),
    ),
  );
});

test("formatVerseDocsStatus omits unavailable optional runtime details", () => {
  const summary = createStatusSummary({
    python: { supported: false, platform: "linux", found: false, checked: [], message: "Python not found" },
    verseMcp: { supported: true, platform: "linux", found: false, checked: [], message: "verse-mcp not found" },
  });
  const output = formatVerseDocsStatus(summary);

  assert.doesNotMatch(output, /python_version:|python_command:|verse_mcp_command:/);
});
