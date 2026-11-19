const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: string): boolean {
  return DATE_RE.test(value);
}

// Form input to a victim count: "" -> null (cleared), invalid -> undefined.
export function parseVictims(raw: string): number | null | undefined {
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return undefined;
  return n;
}

// Form input to a YYYY-MM-DD date: "" -> null (cleared), invalid -> undefined.
export function parseDate(raw: string): string | null | undefined {
  if (raw === "") return null;
  if (isDateString(raw) && !Number.isNaN(Date.parse(raw))) return raw;
  return undefined;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
