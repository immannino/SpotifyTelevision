// Shapes of the Spotify Web API responses we consume, as of the February 2026 API changes
// (playlist `tracks` renamed to `items`, playlist entries' `track` renamed to `item`).
// Only the fields this app reads are declared.

export interface SpotifyImage {
  url: string
  width: number | null
  height: number | null
}

export interface Paging<T> {
  href: string
  items: T[]
  limit: number
  next: string | null
  offset: number
  total: number
}

export interface SpotifyUser {
  id: string
  display_name: string | null
  images: SpotifyImage[]
}

export interface SpotifyPlaylist {
  id: string
  name: string
  collaborative: boolean
  owner: { id: string; display_name: string | null }
  images: SpotifyImage[] | null
  /** Current name for the item count reference. */
  items?: { href: string; total: number }
  /** Pre-2026 name, still returned in some responses. */
  tracks?: { href: string; total: number }
}

export interface SpotifyTrack {
  type: 'track'
  id: string | null
  name: string
  duration_ms: number
  is_local: boolean
  artists: { id: string | null; name: string }[]
  album: { name: string; images: SpotifyImage[] }
}

export interface SpotifyEpisode {
  type: 'episode'
  id: string
  name: string
}

export interface PlaylistEntry {
  added_at: string
  is_local: boolean
  item?: SpotifyTrack | SpotifyEpisode | null
  /** Pre-2026 name for `item`. */
  track?: SpotifyTrack | SpotifyEpisode | null
}

export interface SavedTrackEntry {
  added_at: string
  track: SpotifyTrack
}

export interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}
