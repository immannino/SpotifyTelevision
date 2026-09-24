import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Tokens } from './auth'

vi.mock('./auth', () => ({
  AuthError: class AuthError extends Error {},
  refreshTokens: vi.fn(),
}))

const { refreshTokens } = await import('./auth')
const { createTokenHolder } = await import('./token-holder')

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
  }
}

const tokens = (overrides: Partial<Tokens> = {}): Tokens => ({
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: Date.now() + 3_600_000,
  ...overrides,
})

afterEach(() => vi.mocked(refreshTokens).mockReset())

describe('createTokenHolder', () => {
  it('persists tokens and reads them back', async () => {
    const storage = memoryStorage()
    createTokenHolder('k', storage).set(tokens())
    expect(await createTokenHolder('k', storage).getAccessToken()).toBe('access')
  })

  it('refreshes once when near expiry, even with concurrent callers', async () => {
    vi.mocked(refreshTokens).mockResolvedValue(tokens({ accessToken: 'fresh' }))
    const holder = createTokenHolder('k', memoryStorage())
    holder.set(tokens({ expiresAt: Date.now() + 10_000 }))
    expect(await Promise.all([holder.getAccessToken(), holder.getAccessToken()])).toEqual(['fresh', 'fresh'])
    expect(refreshTokens).toHaveBeenCalledTimes(1)
  })

  it('forgets the login when refreshing fails', async () => {
    vi.mocked(refreshTokens).mockRejectedValue(new Error('revoked'))
    const storage = memoryStorage()
    const holder = createTokenHolder('k', storage)
    holder.set(tokens({ expiresAt: 0 }))
    await expect(holder.getAccessToken()).rejects.toThrow('revoked')
    expect(holder.tokens).toBeNull()
    expect(storage.getItem('k')).toBeNull()
  })

  it('rejects when not connected', async () => {
    await expect(createTokenHolder('k', memoryStorage()).getAccessToken()).rejects.toThrow()
  })
})
