// A small in-memory cache for data that is read often but changes rarely (staff, departments,
// catalogs) and for dashboard summaries. It cuts repeat downloads when moving between pages.
//
// - Kept in memory for this browser tab only. Nothing is written to the device, so no patient
//   data stays behind after the tab closes.
// - Two pages asking for the same thing at once share one request.
// - Any save through the data layer clears the related entries, so this tab sees its own
//   changes straight away. Changes made by other staff show up when an entry expires, or
//   when someone presses Refresh.

interface Entry {
  promise: Promise<unknown>;
  storedAt: number;
  expiresAt: number;
}

const entries = new Map<string, Entry>();

// Returns the cached value for key, loading it when missing or older than ttlMs.
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.promise as Promise<T>;
  const promise = load();
  entries.set(key, { promise, storedAt: now, expiresAt: now + ttlMs });
  // Don't keep failures: the next caller tries again.
  promise.catch(() => { if (entries.get(key)?.promise === promise) entries.delete(key); });
  return promise;
}

// Clears every entry whose key starts with one of the prefixes (all entries if none given).
export function invalidate(...prefixes: string[]): void {
  for (const key of [...entries.keys()]) {
    if (prefixes.length === 0 || prefixes.some(prefix => key.startsWith(prefix))) entries.delete(key);
  }
}

// When the entry for key was loaded, for "Updated at" labels.
export function cachedAt(key: string): Date | null {
  const hit = entries.get(key);
  return hit ? new Date(hit.storedAt) : null;
}

export const MINUTE = 60_000;
