import { beforeEach, describe, expect, it } from 'vitest'
import { KeyPool, parseKeys, resetLocalQuotaState, rotationOrder, secondsUntilQuotaReset, type QuotaStore } from './keys'

function memoryStore() {
  const data = new Map<string, string>()
  const store: QuotaStore & { data: Map<string, string>; ttls: number[] } = {
    data,
    ttls: [],
    get: async (k) => data.get(k) ?? null,
    put: async (k, v, opts) => {
      data.set(k, v)
      if (opts?.expirationTtl) store.ttls.push(opts.expirationTtl)
    },
  }
  return store
}

async function collect(gen: AsyncGenerator<string>) {
  const out: string[] = []
  for await (const k of gen) out.push(k)
  return out
}

// 2026-09-24 12:00:00 Pacific (PDT, UTC-7), on a whole second so rotation is predictable.
const NOON_PT = Date.UTC(2026, 8, 24, 19, 0, 0)

beforeEach(resetLocalQuotaState)

describe('parseKeys', () => {
  it('splits on commas, whitespace and newlines, and dedupes', () => {
    expect(parseKeys('a, b\nc  a', undefined, 'd')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('accepts a JSON array', () => {
    expect(parseKeys('["a","b", "c"]')).toEqual(['a', 'b', 'c'])
  })

  it('strips quotes and brackets from loosely formatted lists', () => {
    expect(parseKeys(`["a", 'b' ,c]`)).toEqual(['a', 'b', 'c'])
    expect(parseKeys('"a","b"')).toEqual(['a', 'b'])
  })

  it('returns nothing when unset', () => {
    expect(parseKeys(undefined, '')).toEqual([])
  })
})

describe('rotationOrder', () => {
  it('starts from the key picked by the current second and wraps', () => {
    expect(rotationOrder(3, 4_000)).toEqual([1, 2, 0])
    expect(rotationOrder(3, 5_999)).toEqual([2, 0, 1])
  })

  it('spreads starting keys evenly over time', () => {
    const starts = Array.from({ length: 300 }, (_, s) => rotationOrder(3, s * 1000)[0])
    expect(starts.filter((i) => i === 0)).toHaveLength(100)
  })
})

describe('secondsUntilQuotaReset', () => {
  it('counts down to midnight Pacific', () => {
    expect(secondsUntilQuotaReset(NOON_PT)).toBe(12 * 3600)
  })

  it('never goes below KV’s 60s minimum TTL', () => {
    expect(secondsUntilQuotaReset(NOON_PT + 12 * 3600 * 1000 - 5_000)).toBe(60)
  })
})

describe('KeyPool', () => {
  it('yields every key, starting from the rotation point', async () => {
    const pool = new KeyPool(['k0', 'k1', 'k2'], memoryStore(), () => NOON_PT + 1_000)
    const expected = rotationOrder(3, NOON_PT + 1_000).map((i) => `k${i}`)
    expect(await collect(pool.available())).toEqual(expected)
  })

  it('skips keys marked exhausted, across isolates via the store', async () => {
    const store = memoryStore()
    const now = () => NOON_PT
    await new KeyPool(['k0', 'k1', 'k2'], store, now).markExhausted('k1')
    expect(store.ttls).toEqual([12 * 3600])

    resetLocalQuotaState() // simulate a different isolate with no local memory
    const keys = await collect(new KeyPool(['k0', 'k1', 'k2'], store, now).available())
    expect(keys).not.toContain('k1')
    expect(keys).toHaveLength(2)
  })

  it('never writes raw keys to the store', async () => {
    const store = memoryStore()
    await new KeyPool(['super-secret-key'], store, () => NOON_PT).markExhausted('super-secret-key')
    expect([...store.data.keys()].join()).not.toContain('super-secret-key')
  })

  it('makes keys available again the next Pacific day', async () => {
    const store = memoryStore()
    await new KeyPool(['k0'], store, () => NOON_PT).markExhausted('k0')
    resetLocalQuotaState()
    const tomorrow = NOON_PT + 24 * 3600 * 1000
    expect(await collect(new KeyPool(['k0'], store, () => tomorrow).available())).toEqual(['k0'])
  })

  it('stops lazily, so later keys are not checked once one works', async () => {
    const store = memoryStore()
    let reads = 0
    const counting: QuotaStore = { ...store, get: (k) => (reads++, store.get(k)) }
    const pool = new KeyPool(['k0', 'k1', 'k2'], counting, () => NOON_PT)
    for await (const _ of pool.available()) break
    expect(reads).toBe(1)
  })
})
