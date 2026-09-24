import type { Paging, PlaybackState, PlaylistEntry, SavedTrackEntry, SpotifyPlaylist, SpotifyUser } from './types'

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
    /** Spotify's machine-readable reason, e.g. PREMIUM_REQUIRED or NO_ACTIVE_DEVICE. */
    readonly reason?: string,
  ) {
    super(message)
  }
}

export type PlayerCommand = 'next' | 'previous' | 'play' | 'pause'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  signal?: AbortSignal
  /** Off for commands: a 5xx may still have been carried out, and repeating "next" skips twice. */
  retryServerErrors?: boolean
}

export function createSpotifyApi(tokens: TokenSource) {
  async function request<T>(pathOrUrl: string, { method = 'GET', signal, retryServerErrors = true }: RequestOptions = {}): Promise<T> {
    const url = pathOrUrl.startsWith('https://') ? pathOrUrl : API_URL + pathOrUrl
    let token = await tokens.getAccessToken()

    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, signal })
      if (res.ok) {
        // 204s and some player commands have no body.
        const text = await res.text()
        return (text ? JSON.parse(text) : null) as T
      }

      if (res.status === 401 && attempt === 0) {
        token = await tokens.forceRefresh()
        continue
      }
      if ((res.status === 429 || (retryServerErrors && res.status >= 500)) && attempt < MAX_RETRIES) {
        // Retry-After is in seconds; fall back to exponential backoff when it isn't exposed.
        const retryAfter = Number(res.headers.get('Retry-After'))
        await sleep(retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 500 * 2 ** attempt, signal)
        continue
      }

      const body = (await res.json().catch(() => null)) as { error?: { message?: string; reason?: string } } | null
      throw new SpotifyApiError(res.status, body?.error?.message ?? `Spotify request failed (${res.status})`, body?.error?.reason)
    }
  }

  /** Walks a paginated endpoint, yielding each page as it arrives. */
  async function* paginate<T>(firstUrl: string, signal?: AbortSignal): AsyncGenerator<Paging<T>> {
    let url: string | null = firstUrl
    while (url) {
      const page: Paging<T> = await request<Paging<T>>(url, { signal })
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
    /** What's playing in any Spotify app; null when nothing is (204). */
    playbackState: () => request<PlaybackState | null>('/me/player?additional_types=track'),
    /** Controls whatever Spotify device is active. Spotify requires Premium for these. */
    playerCommand: (command: PlayerCommand) =>
      request<null>(`/me/player/${command}`, {
        method: command === 'play' || command === 'pause' ? 'PUT' : 'POST',
        retryServerErrors: false,
      }),
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
