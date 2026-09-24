// A persisted Spotify login that refreshes itself. Used by the TV, which follows Spotify with
// its own grant; the phone's session lives in stores/auth.ts.
import type { TokenSource } from './api'
import { AuthError, refreshTokens, type Tokens } from './auth'

/** Refresh this long before expiry so in-flight requests don't race the deadline. */
const EXPIRY_MARGIN_MS = 60_000

export interface TokenHolder extends TokenSource {
  readonly tokens: Tokens | null
  set(tokens: Tokens): void
  clear(): void
}

export function createTokenHolder(storageKey: string, storage: Storage = localStorage): TokenHolder {
  let tokens = read()
  let refreshing: Promise<string> | null = null

  function read(): Tokens | null {
    try {
      const raw = storage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as Tokens) : null
    } catch {
      return null
    }
  }

  function set(next: Tokens) {
    tokens = next
    storage.setItem(storageKey, JSON.stringify(next))
  }

  function clear() {
    tokens = null
    storage.removeItem(storageKey)
  }

  function forceRefresh(): Promise<string> {
    refreshing ??= (async () => {
      try {
        if (!tokens?.refreshToken) throw new AuthError('No refresh token')
        set(await refreshTokens(tokens.refreshToken))
        return tokens!.accessToken
      } catch (err) {
        // The grant was revoked or expired; the owner has to connect again.
        clear()
        throw err
      } finally {
        refreshing = null
      }
    })()
    return refreshing
  }

  return {
    get tokens() {
      return tokens
    },
    set,
    clear,
    forceRefresh,
    async getAccessToken() {
      if (!tokens) throw new AuthError('Not connected to Spotify')
      if (tokens.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return tokens.accessToken
      return forceRefresh()
    },
  }
}
