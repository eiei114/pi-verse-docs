const DEFAULT_MAX_CHARS = 12_000;

function truncateText(value: string, maxChars = DEFAULT_MAX_CHARS): string {
  if (value.length <= maxChars) return value;
  let body = value.slice(0, maxChars);
  const last = body.charCodeAt(body.length - 1);
  const next = value.charCodeAt(body.length);
  // Keep the UTF-16 budget, but never split a surrogate pair at the cutoff.
  if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
    body = body.slice(0, -1);
  }
  return `${body}\n\n[truncated ${value.length - body.length} chars]`;
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
