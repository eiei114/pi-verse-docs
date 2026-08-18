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
  assert.match(examples, /verse_docs_search_api/);
  assert.match(examples, /verse_docs_list_chapters/);
  assert.match(examples, /\/verse-docs:status/);
  assert.match(examples, /\/verse-docs:search-api/);
});

test("docs/examples.md includes at least three realistic workflow examples", () => {
  const exampleSections = examples.match(/^## Example \d+:/gm) ?? [];
  assert.ok(
    exampleSections.length >= 3,
    `expected at least 3 workflow examples, found ${exampleSections.length}`,
  );
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

test("docs/examples.md related document links resolve", async () => {
  const relatedDocLinks = [
    { label: "README", target: "../README.md" },
    { label: "docs/release.md", target: "release.md" },
  ];

  for (const { label, target } of relatedDocLinks) {
    assert.ok(
      examples.includes(`[${label}](${target})`),
      `docs/examples.md should link ${label} to ${target}`,
    );
    await access(new URL(target, examplesPath));
  }
});
