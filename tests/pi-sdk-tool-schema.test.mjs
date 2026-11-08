import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

// pi-schema is the validator Pi 1.5.0 runs on tool arguments. It installs next
// to pi-coding-agent because the Pi packages share the exact same version, so
// this resolves the host's copy instead of a second one from elsewhere.
function resolvePiSchemaEntry() {
  const candidates = [];
  try {
    candidates.push(import.meta.resolve("@earendil-works/pi-schema"));
  } catch {
    // Fall through to the installed package path.
  }
  candidates.push(pathToFileURL(resolve(root, "node_modules/@earendil-works/pi-schema/dist/index.js")).href);
  const entry = candidates.find((url) => existsSync(fileURLToPath(url)));
  assert.ok(entry, "the Pi host's @earendil-works/pi-schema must be installed");
  return entry;
}

const schemaEntry = resolvePiSchemaEntry();
const { compile } = await import(schemaEntry);

const agentDir = mkdtempSync(resolve(tmpdir(), "pi-verse-docs-schema-"));
const loaded = await discoverAndLoadExtensions([root], root, agentDir);
rmSync(agentDir, { recursive: true, force: true });

const loadedTools = loaded.extensions[0]?.tools;
const tools = (loadedTools instanceof Map ? [...loadedTools.values()] : [...(loadedTools ?? [])])
  .map((tool) => tool.definition ?? tool);
const toolNamed = (name) => tools.find((tool) => tool.name === name);

test("the actual Pi 1.5.0 loader loads this extension without errors", () => {
  assert.deepEqual(loaded.errors, []);
  assert.deepEqual(loaded.warnings ?? [], []);
  assert.equal(loaded.extensions.length, 1);

  const commands = loaded.extensions[0].commands;
  const commandNames = commands instanceof Map ? [...commands.keys()] : Object.keys(commands ?? {});
  assert.ok(commandNames.includes("verse-docs:search"), `registered commands: ${commandNames.join(", ")}`);
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "verse_docs_status",
      "verse_docs_search",
      "verse_docs_search_api",
      "verse_docs_get_chapter",
      "verse_docs_get_api_module",
      "verse_docs_list_chapters",
      "verse_docs_list_api_modules",
      "verse_docs_cache_all",
    ],
  );
});

test("the tested validator is the single pi-schema copy the Pi host installs", () => {
  const lockfile = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const schemaCopies = Object.keys(lockfile.packages).filter((path) => path.endsWith("/@earendil-works/pi-schema"));
  assert.deepEqual(schemaCopies, ["node_modules/@earendil-works/pi-schema"]);
  assert.equal(
    lockfile.packages["node_modules/@earendil-works/pi-schema"].version,
    lockfile.packages["node_modules/@earendil-works/pi-coding-agent"].version,
  );
  assert.ok(
    fileURLToPath(schemaEntry).startsWith(resolve(root, "node_modules/@earendil-works/pi-schema")),
    `compiled against ${schemaEntry}`,
  );
});

test("every registered tool schema compiles under the Pi 1.5.0 pi-schema validator", () => {
  for (const tool of tools) {
    assert.doesNotThrow(() => compile(tool.parameters, { coerce: true }), `${tool.name} schema must compile`);
  }
});

test("tool arguments are validated and coerced like Pi 1.5.0 does", () => {
  const validator = compile(toolNamed("verse_docs_search").parameters, { coerce: true });

  assert.deepEqual(validator.parse({ query: "decides", maxChars: "2500", timeoutMs: "1500" }), {
    ok: true,
    value: { query: "decides", maxChars: 2500, timeoutMs: 1500 },
  });

  const missing = validator.parse({});
  assert.equal(missing.ok, false);
  assert.deepEqual(
    missing.errors.map((error) => `${error.path}: ${error.message}`),
    ["/query: missing"],
  );

  const wrongType = validator.parse({ query: "decides", maxChars: "not-a-number" });
  assert.equal(wrongType.ok, false);
  assert.deepEqual(
    wrongType.errors.map((error) => `${error.path}: ${error.message}`),
    ["/maxChars: expected number, got string"],
  );
});

test("schemas stay inside JSON Schema, so 1.5.0 drops no TypeBox-only constraint", () => {
  for (const tool of tools) {
    const serialized = JSON.stringify(tool.parameters);
    for (const keyword of ["$ref", "codec", "bigint", "undefined", "void"]) {
      assert.equal(serialized.includes(keyword), false, `${tool.name} must not depend on TypeBox-only ${keyword}`);
    }
  }
});
