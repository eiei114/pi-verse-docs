import { resolve } from "node:path";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function smokeReportPath(root, updateCuratedReport = false) {
  return resolve(root, updateCuratedReport ? "docs/verification/pi-sdk-smoke.json" : ".tmp/pi-sdk-smoke.json");
}

export function redactRepositoryRootPaths(value, repoRoot) {
  const root = repoRoot.replace(/[\\/]+$/, "");
  const variants = new Set([root, root.replaceAll("\\", "/"), root.replaceAll("/", "\\")]);
  let escapedRoot = root;
  for (let depth = 0; depth < 3; depth += 1) {
    escapedRoot = escapedRoot.replaceAll("\\", "\\\\");
    variants.add(escapedRoot);
  }
  const flags = process.platform === "win32" ? "gi" : "g";

  return [...variants]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .reduce((text, variant) => text.replace(new RegExp(escapeRegExp(variant), flags), "<repo-root>"), value);
}

export function serializeRedactedReport(report, repoRoot) {
  return redactRepositoryRootPaths(JSON.stringify(report, null, 2), repoRoot);
}
