// Rotates searches across several YouTube API keys.
//
// Workers run in many isolates with no shared memory, so a counter can't do round robin.
// Instead the starting key comes from the request's arrival time, which spreads load
// evenly, and a key that runs out of quota is recorded in KV until YouTube's daily reset
// so no isolate keeps trying it. KV stores only a hash of each key, never the key.

/** Minimal slice of KVNamespace, so tests can pass a stub. */
export interface QuotaStore {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

/**
 * Accepts a JSON array (`["k1","k2"]`) or keys separated by commas, whitespace or
 * newlines, optionally quoted. Drops duplicates.
 */
export function parseKeys(...sources: (string | undefined)[]): string[] {
  const keys = sources
    .flatMap((source) => {
      const text = (source ?? '').trim()
      if (text.startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(text)
          if (Array.isArray(parsed)) return parsed.map(String)
        } catch {
          // Not valid JSON; fall through to splitting.
        }
      }
      return text.split(/[\s,]+/)
    })
    .map((key) => key.trim().replace(/^[\s"'[]+|[\s"'\]]+$/g, ''))
    .filter(Boolean)
  return [...new Set(keys)]
}

/** Key indices to try, starting from one chosen by the current second. */
export function rotationOrder(count: number, now: number): number[] {
  const start = Math.floor(now / 1000) % count
  return Array.from({ length: count }, (_, i) => (start + i) % count)
}

const pacificParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function pacific(now: number) {
  const parts = Object.fromEntries(pacificParts.formatToParts(now).map((p) => [p.type, p.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    secondsIntoDay: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  }
}

/** YouTube quotas reset at midnight Pacific time. KV requires TTLs of at least 60s. */
export function secondsUntilQuotaReset(now: number): number {
  return Math.max(60, 86_400 - pacific(now).secondsIntoDay)
}

async function fingerprint(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Per-isolate memo of exhausted keys (fingerprint → epoch ms), saving KV reads. */
const exhaustedLocally = new Map<string, number>()

export class KeyPool {
  constructor(
    private readonly keys: string[],
    private readonly store: QuotaStore,
    private readonly now: () => number = Date.now,
  ) {}

  get size() {
    return this.keys.length
  }

  /** Yields keys in rotation order, skipping any known to be out of quota today. */
  async *available(): AsyncGenerator<string> {
    for (const i of rotationOrder(this.keys.length, this.now())) {
      const key = this.keys[i]!
      if (!(await this.isExhausted(key))) yield key
    }
  }

  async markExhausted(key: string): Promise<void> {
    const now = this.now()
    const ttl = secondsUntilQuotaReset(now)
    const fp = await fingerprint(key)
    exhaustedLocally.set(fp, now + ttl * 1000)
    await this.store.put(this.storeKey(fp, now), '1', { expirationTtl: ttl })
    console.warn(`YouTube key ${fp} is out of quota until the daily reset (${ttl}s)`)
  }

  static async describe(key: string): Promise<string> {
    return fingerprint(key)
  }

  private async isExhausted(key: string): Promise<boolean> {
    const now = this.now()
    const fp = await fingerprint(key)
    const until = exhaustedLocally.get(fp)
    if (until !== undefined) {
      if (until > now) return true
      exhaustedLocally.delete(fp)
    }
    // Keyed by Pacific date so a mark from yesterday never counts, whatever the TTL did.
    if ((await this.store.get(this.storeKey(fp, now))) === null) return false
    exhaustedLocally.set(fp, now + secondsUntilQuotaReset(now) * 1000)
    return true
  }

  private storeKey(fp: string, now: number) {
    return `quota:${pacific(now).date}:${fp}`
  }
}

/** Test hook: forget per-isolate state between cases. */
export function resetLocalQuotaState() {
  exhaustedLocally.clear()
}
