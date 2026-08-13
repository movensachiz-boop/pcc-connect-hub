/**
 * Central Africa Time (CAT, UTC+2) helpers.
 *
 * When the device is online we sync against an internet time source so a wrong
 * gadget clock can't stamp records with the wrong day/time. When offline we
 * fall back to the device clock (still converted to CAT).
 */

const TZ = "Africa/Harare"; // CAT, no DST
let offsetMs = 0; // internetTime - deviceTime
let synced = false;

async function readServerDate(url: string, init?: RequestInit): Promise<number | null> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const header = res.headers.get("date");
    if (header) {
      const t = Date.parse(header);
      if (!Number.isNaN(t)) return t;
    }
    const body = await res.clone().json().catch(() => null) as { utc_datetime?: string; datetime?: string } | null;
    const iso = body?.utc_datetime || body?.datetime;
    if (iso) {
      const t = Date.parse(iso);
      if (!Number.isNaN(t)) return t;
    }
  } catch {
    /* offline or blocked */
  }
  return null;
}

/** Sync the clock offset with the internet. Safe to call repeatedly. */
export async function syncCatTime(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  const started = Date.now();
  let server = await readServerDate(`${window.location.origin}/?_t=${started}`, { method: "HEAD" });
  if (server === null) server = await readServerDate("https://worldtimeapi.org/api/timezone/Etc/UTC");
  if (server === null) return false;
  // account for round-trip: assume response was generated halfway
  const latency = (Date.now() - started) / 2;
  offsetMs = server + latency - Date.now();
  synced = true;
  return true;
}

export function isTimeSynced() {
  return synced;
}

/** Current instant, corrected by the internet offset when available. */
export function nowDate(): Date {
  return new Date(Date.now() + offsetMs);
}

/** Current instant as an ISO string (UTC), corrected by the internet offset. */
export function nowIso(): string {
  return nowDate().toISOString();
}

/** Parts of the current time expressed in CAT. */
function catParts(d: Date = nowDate()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  fmt.formatToParts(d).forEach(part => { if (part.type !== "literal") p[part.type] = part.value; });
  return p;
}

/** Business date (YYYY-MM-DD) in CAT. */
export function catToday(d?: Date): string {
  const p = catParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hour of day (0-23) in CAT. */
export function catHour(d?: Date): number {
  return Number(catParts(d).hour);
}

/** Format any instant as a CAT time string, e.g. "14:05". */
export function catTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = catParts(d);
  return `${p.hour}:${p.minute}`;
}

/** Format any instant as a full CAT date-time string. */
export function catDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p = catParts(d);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} CAT`;
}

let started = false;
export function initCatTime() {
  if (started || typeof window === "undefined") return;
  started = true;
  void syncCatTime();
  window.addEventListener("online", () => { void syncCatTime(); });
  window.addEventListener("focus", () => { void syncCatTime(); });
  window.setInterval(() => { void syncCatTime(); }, 10 * 60 * 1000);
}
