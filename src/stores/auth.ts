import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { AuthError, completeLogin, refreshTokens, type Tokens } from '@/lib/spotify/auth'
import { createSpotifyApi, type SpotifyApi } from '@/lib/spotify/api'

const STORAGE_KEY = 'stv:tokens'
/** Refresh this long before expiry so in-flight requests don't race the deadline. */
const EXPIRY_MARGIN_MS = 60_000

export const useAuthStore = defineStore('auth', () => {
  const tokens = ref<Tokens | null>(readStoredTokens())
  const sessionExpired = ref(false)
  const isAuthenticated = computed(() => tokens.value !== null)

  watch(tokens, (value) => {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  })

  let refreshing: Promise<string> | null = null

  function forceRefresh(): Promise<string> {
    refreshing ??= (async () => {
      try {
        if (!tokens.value?.refreshToken) throw new AuthError('No refresh token')
        tokens.value = await refreshTokens(tokens.value.refreshToken)
        return tokens.value.accessToken
      } catch (err) {
        logout({ expired: true })
        throw err
      } finally {
        refreshing = null
      }
    })()
    return refreshing
  }

  async function getAccessToken(): Promise<string> {
    if (!tokens.value) throw new AuthError('Not logged in')
    if (tokens.value.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return tokens.value.accessToken
    return forceRefresh()
  }

  async function handleCallback(code: string, state: string | null) {
    tokens.value = await completeLogin(code, state)
    sessionExpired.value = false
  }

  function logout({ expired = false } = {}) {
    tokens.value = null
    sessionExpired.value = expired
  }

  return { isAuthenticated, sessionExpired, getAccessToken, forceRefresh, handleCallback, logout }
})

let api: SpotifyApi | undefined

export function useSpotifyApi(): SpotifyApi {
  const auth = useAuthStore()
  return (api ??= createSpotifyApi({ getAccessToken: auth.getAccessToken, forceRefresh: auth.forceRefresh }))
}

function readStoredTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}
