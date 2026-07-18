import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import test from "node:test";

const examplesPath = new URL("../docs/examples.md", import.meta.url);
const examples = await readFile(examplesPath, "utf8");

const staleTemplateReferences = [
  "extensions/hello.ts",
  "/template-hello",
  "skills/example-skill/SKILL.md",
  "lib/greeting.ts",
  "/template-info",
  "template_greet",
];

test("docs/examples.md does not reference removed template artifacts", () => {
  for (const stale of staleTemplateReferences) {
    assert.equal(
      examples.includes(stale),
      false,
      `docs/examples.md still references stale template path: ${stale}`,
    );
  }
});

test("docs/examples.md documents current pi-verse-docs resources", () => {
  assert.match(examples, /extensions\/index\.ts/);
  assert.match(examples, /skills\/verse-dev\/SKILL\.md/);
  assert.match(examples, /verse_docs_search/);
  assert.match(examples, /\/verse-docs:status/);
});

test("docs/examples.md paths exist in the repository", async () => {
  const requiredPaths = [
    "../extensions/index.ts",
    "../skills/verse-dev/SKILL.md",
  ];

  for (const relativePath of requiredPaths) {
    await access(new URL(relativePath, examplesPath));
  }
});
