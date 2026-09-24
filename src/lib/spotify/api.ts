import type { Paging, PlaylistEntry, SavedTrackEntry, SpotifyPlaylist, SpotifyUser } from './types'

const API_URL = 'https://api.spotify.com/v1'
const MAX_RETRIES = 4

export interface TokenSource {
  /** Returns a valid access token, refreshing first if it's near expiry. */
  getAccessToken(): Promise<string>
  /** Called after a 401 to force a refresh; resolves to the new token. */
  forceRefresh(): Promise<string>
}

export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function createSpotifyApi(tokens: TokenSource) {
  async function request<T>(pathOrUrl: string, signal?: AbortSignal): Promise<T> {
    const url = pathOrUrl.startsWith('https://') ? pathOrUrl : API_URL + pathOrUrl
    let token = await tokens.getAccessToken()

    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal })
      if (res.ok) return (await res.json()) as T

      if (res.status === 401 && attempt === 0) {
        token = await tokens.forceRefresh()
        continue
      }
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        // Retry-After is in seconds; fall back to exponential backoff when it isn't exposed.
        const retryAfter = Number(res.headers.get('Retry-After'))
        await sleep(retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 500 * 2 ** attempt, signal)
        continue
      }

      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new SpotifyApiError(res.status, body?.error?.message ?? `Spotify request failed (${res.status})`)
    }
  }

  /** Walks a paginated endpoint, yielding each page as it arrives. */
  async function* paginate<T>(firstUrl: string, signal?: AbortSignal): AsyncGenerator<Paging<T>> {
    let url: string | null = firstUrl
    while (url) {
      const page: Paging<T> = await request<Paging<T>>(url, signal)
      yield page
      url = page.next
    }
  }

  return {
    getMe: () => request<SpotifyUser>('/me'),
    myPlaylists: (signal?: AbortSignal) => paginate<SpotifyPlaylist>('/me/playlists?limit=50', signal),
    playlistItems: (playlistId: string, signal?: AbortSignal) =>
      paginate<PlaylistEntry>(`/playlists/${encodeURIComponent(playlistId)}/items?limit=50&additional_types=track`, signal),
    likedSongs: (signal?: AbortSignal) => paginate<SavedTrackEntry>('/me/tracks?limit=50', signal),
  }
}

export type SpotifyApi = ReturnType<typeof createSpotifyApi>

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}
