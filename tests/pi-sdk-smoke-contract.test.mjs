import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { behaviorAssertions, parseJsonLines, VERIFICATION_CONTRACT } from "../scripts/pi-sdk-smoke-contract.mjs";
import { redactRepositoryRootPaths, serializeRedactedReport, smokeReportPath } from "../scripts/pi-sdk-smoke-report.mjs";

const command = { command: "get_commands", success: true, data: { commands: [{ name: "verse-docs:search", source: "extension" }] } };
const prompt = { type: "response", command: "prompt", success: true, data: { disposition: "handled" } };
const result = { type: "extension_ui_request", method: "notify", message: "SMOKE_RESULT:decides" };
const error = { type: "extension_ui_request", method: "notify", message: "verse-mcp search_verse_docs failed: MCP error -32000: controlled smoke error" };
const observed = (responses = [command, prompt, result], fullOutput = "", exit_code = 0) => ({
  responses, fullOutput, exit_code, expectedVersion: "1.2.0",
});

test("smoke uses the behavior-v2 contract and parses JSON lines", () => {
  assert.equal(VERIFICATION_CONTRACT, "pi-sdk-behavior-v2");
  assert.deepEqual(parseJsonLines(`not-json\r\n${JSON.stringify(prompt)}\n`), [prompt]);
});

test("extension load and happy path require the real command and feature response", () => {
  assert.equal(behaviorAssertions("extension_load", observed([command]))[0].id, "extension_registered");
  assert.equal(behaviorAssertions("extension_load", observed([]))[0].passed, false);
  assert.equal(behaviorAssertions("happy_path", observed())[0].passed, true);
  for (const responses of [[], [command], [command, { ...prompt, success: false }, result], [command, prompt]]) {
    assert.equal(behaviorAssertions("happy_path", observed(responses))[0].passed, false);
  }
});

test("error path requires a handled, user-visible negative result", () => {
  assert.equal(behaviorAssertions("error_path", observed([command, prompt, error]))[0].passed, true);
  for (const responses of [[], [command, prompt], [command, { ...prompt, success: false }, error]]) {
    assert.equal(behaviorAssertions("error_path", observed(responses))[0].passed, false);
  }
});

test("reload needs second-process registration, feature result, and clean shutdown", () => {
  const good = behaviorAssertions("reload_cleanup", observed());
  assert.deepEqual(good.map((item) => item.id), ["reloaded_extension_registered", "reloaded_feature_response", "clean_shutdown"]);
  assert.ok(good.every((item) => item.passed));
  for (const responses of [[], [command], [command, prompt], [prompt, result]]) {
    assert.ok(behaviorAssertions("reload_cleanup", observed(responses)).some((item) => !item.passed));
  }
  for (const [output, code] of [["shutdown error", 0], ["UnhandledPromiseRejection", 0], ["", 1]]) {
    assert.equal(behaviorAssertions("reload_cleanup", observed(undefined, output, code))[2].passed, false);
  }
});

test("native shell assertion matches exactly the pinned version", () => {
  assert.equal(behaviorAssertions("host_shell", observed([], "1.2.0\r\n"))[0].passed, true);
  for (const output of ["", "11.2.0", "1.1.0", "1.2.0 with error"]) {
    assert.equal(behaviorAssertions("host_shell", observed([], output))[0].passed, false);
  }
});

test("smoke reports default to ignored output and only update the curated report explicitly", () => {
  const root = resolve(String.raw`C:\Users\private\workspace\pi-verse-docs`);
  assert.equal(smokeReportPath(root), resolve(root, ".tmp/pi-sdk-smoke.json"));
  assert.equal(smokeReportPath(root, true), resolve(root, "docs/verification/pi-sdk-smoke.json"));
});

test("smoke evidence redacts native and JSON-escaped repository-root paths", () => {
  const root = String.raw`C:\Users\private\workspace\pi-verse-docs`;
  const rawEvidence = `extension ${root}\\extensions\\index.ts`;
  const escapedEvidence = JSON.stringify({ sourceInfo: { path: `${root}\\skills\\verse-dev\\SKILL.md` } });
  const report = { evidence: rawEvidence, assertions: [{ observed: escapedEvidence }] };

  const redactedEvidence = redactRepositoryRootPaths(`${rawEvidence}\n${escapedEvidence}`, root);
  const serialized = serializeRedactedReport(report, root);

  assert.ok(redactedEvidence.includes("<repo-root>"));
  assert.ok(!redactedEvidence.toLowerCase().includes("c:\\\\users\\\\private"));
  assert.ok(serialized.includes("<repo-root>"));
  assert.ok(!serialized.toLowerCase().includes("c:\\\\users\\\\private"));
  assert.deepEqual(JSON.parse(serialized), {
    evidence: "extension <repo-root>\\extensions\\index.ts",
    assertions: [{ observed: '{"sourceInfo":{"path":"<repo-root>\\\\skills\\\\verse-dev\\\\SKILL.md"}}' }],
  });

  const posixRoot = "/private/runner/work/pi-verse-docs";
  const posixEvidence = JSON.stringify({ sourceInfo: { path: `${posixRoot}/extensions/index.ts` } });
  const posixReport = serializeRedactedReport({ evidence: posixEvidence }, posixRoot);
  assert.deepEqual(JSON.parse(posixReport), {
    evidence: '{"sourceInfo":{"path":"<repo-root>/extensions/index.ts"}}',
  });
});
