import assert from "node:assert/strict";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url);

const DOC_GLOBS = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "CHANGELOG.md",
  "docs",
  "skills",
];

const MARKDOWN_LINK = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;

const FENCE_OPENER = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSER = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

function stripFencedCodeBlocks(markdown) {
  const kept = [];
  let openFence = null;

  for (const line of markdown.split(/\r?\n/)) {
    if (openFence === null) {
      const opener = line.match(FENCE_OPENER);
      if (opener) {
        // Backtick and tilde fences are separate families; remember the run
        // length so a shorter run stays ordinary content.
        openFence = { marker: opener[1][0], length: opener[1].length };
        continue;
      }
      kept.push(line);
      continue;
    }

    // Only the same marker repeated at least as many times as the opener, with
    // nothing but trailing whitespace after it, closes the fence. Indentation
    // is capped at three spaces so four-space indented code blocks are left for
    // the link scan to see.
    const closer = line.match(FENCE_CLOSER);
    if (closer && closer[1][0] === openFence.marker && closer[1].length >= openFence.length) {
      openFence = null;
    }
  }

  return kept.join("\n");
}

function isExternalTarget(target) {
  return (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("#")
  );
}

function extractMarkdownLinks(markdown) {
  const prose = stripFencedCodeBlocks(markdown);
  const links = [];
  for (const match of prose.matchAll(MARKDOWN_LINK)) {
    links.push(match[1].trim());
  }
  return links;
}

function resolveLocalTarget(sourceFile, target) {
  const [pathPart] = target.split("#");
  if (!pathPart || pathPart.startsWith("/")) {
    return null;
  }

  const sourceDir = dirname(fileURLToPath(sourceFile));
  return pathToFileURL(join(sourceDir, pathPart));
}

async function collectMarkdownFiles(relativePath) {
  const absolutePath = fileURLToPath(new URL(relativePath, repoRoot));
  const entries = await readdir(absolutePath, { withFileTypes: true, recursive: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const parent = entry.parentPath ?? entry.path;
    files.push(pathToFileURL(join(parent, entry.name)));
  }

  return files;
}

async function loadDocFiles() {
  const files = [];

  for (const relativePath of DOC_GLOBS) {
    const url = new URL(relativePath, repoRoot);
    const info = await stat(url);
    if (info.isFile()) {
      files.push(url);
      continue;
    }

    if (info.isDirectory()) {
      files.push(...(await collectMarkdownFiles(relativePath)));
    }
  }

  return files;
}

const docFiles = await loadDocFiles();

test("documentation markdown files are discoverable", () => {
  assert.ok(docFiles.length >= 5, `expected doc files, found ${docFiles.length}`);
});

test("internal markdown links resolve to existing files", async () => {
  const brokenLinks = [];

  for (const docFile of docFiles) {
    const markdown = await readFile(docFile, "utf8");
    const links = extractMarkdownLinks(markdown);

    for (const target of links) {
      if (isExternalTarget(target)) {
        continue;
      }

      const resolved = resolveLocalTarget(docFile, target);
      if (!resolved) {
        brokenLinks.push({ file: docFile.pathname, target, reason: "unsupported local target" });
        continue;
      }

      try {
        await access(resolved);
      } catch {
        brokenLinks.push({ file: docFile.pathname, target, reason: "missing file" });
      }
    }
  }

  assert.deepEqual(
    brokenLinks,
    [],
    brokenLinks.map(({ file, target, reason }) => `${file}: [${target}] (${reason})`).join("\n"),
  );
});

test("stripFencedCodeBlocks removes only real fenced code blocks", async () => {
  const fixture = await readFile(new URL("fixtures/fenced-code-sample.md", import.meta.url), "utf8");
  const prose = stripFencedCodeBlocks(fixture);

  assert.ok(
    prose.includes("indented-code-missing.md"),
    "four-space indented code blocks must be preserved",
  );

  for (const stripped of [
    "tilde-fenced-missing.md",
    "backtick-fenced-missing.md",
    "indented-fence-missing.md",
  ]) {
    assert.ok(!prose.includes(stripped), `${stripped} must be stripped together with its fence`);
  }
});

test("README links to published documentation entry points", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  for (const target of ["docs/examples.md", "docs/release.md", "SECURITY.md"]) {
    assert.match(readme, new RegExp(`\\]\\(${target.replace(".", "\\.")}\\)`));
    await access(new URL(`../${target}`, import.meta.url));
  }
});
