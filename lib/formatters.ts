const DEFAULT_MAX_CHARS = 12_000;

function truncateText(value: string, maxChars = DEFAULT_MAX_CHARS): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]`;
}

function stringifyUnknown(value: unknown, maxChars = DEFAULT_MAX_CHARS): string {
  return truncateText(JSON.stringify(value, null, 2), maxChars);
}

export function formatMcpTextResult(result: unknown, maxChars = DEFAULT_MAX_CHARS): string {
  if (typeof result === "string") return truncateText(result, maxChars);

  if (typeof result !== "object" || result === null || !("content" in result) || !Array.isArray(result.content)) {
    return stringifyUnknown(result, maxChars);
  }

  const lines: string[] = [];
  for (const item of result.content) {
    if (typeof item !== "object" || item === null) {
      lines.push(String(item));
      continue;
    }

    const record = item as { type?: unknown; text?: unknown };
    if (record.type === "text" && typeof record.text === "string") {
      lines.push(record.text);
      continue;
    }

    lines.push(JSON.stringify(record, null, 2));
  }

  return truncateText(lines.join("\n"), maxChars);
}

export function formatCacheAllResult(result: unknown, cacheDir: string, maxChars = DEFAULT_MAX_CHARS): string {
  const body = formatMcpTextResult(result, maxChars);
  return `${body}\n\nCache dir: ${cacheDir}`;
}

export const VERSE_DOCS_DEFAULT_MAX_CHARS = DEFAULT_MAX_CHARS;
