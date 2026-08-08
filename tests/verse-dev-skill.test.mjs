import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skillPath = new URL("../skills/verse-dev/SKILL.md", import.meta.url);
const skill = await readFile(skillPath, "utf8");

test("verse-dev skill does not reference private vault paths", () => {
  assert.equal(skill.includes("4_Project/"), false, "skill still references a private vault path");
});

test("verse-dev skill links public ecosystem resources", () => {
  assert.match(skill, /https:\/\/github\.com\/BurgersJackson\/verse-mcp/);
  assert.match(skill, /https:\/\/github\.com\/eiei114\/pi-verse-docs/);
});
