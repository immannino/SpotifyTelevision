import type { PlaylistEntry, SavedTrackEntry, SpotifyImage, SpotifyPlaylist, SpotifyTrack, SpotifyUser } from './spotify/types'

export const LIKED_SONGS_ID = 'liked'

export interface Playlist {
  id: string
  name: string
  ownerName: string | null
  artworkUrl: string | null
  total: number | null
  /** Spotify only returns contents for playlists the user owns or collaborates on. */
  readable: boolean
}

export interface Track {
  /** Spotify track ID; null for local files, which can't be looked up. */
  id: string | null
  name: string
  artists: string[]
  album: string
  artworkUrl: string | null
  durationMs: number
  playable: boolean
}

/** Picks the smallest image that is at least `minSize` wide, falling back to the largest. */
export function pickImage(images: SpotifyImage[] | null | undefined, minSize = 64): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  return (sorted.find((img) => (img.width ?? 0) >= minSize) ?? sorted[sorted.length - 1])!.url
}

export function toPlaylist(p: SpotifyPlaylist, me: SpotifyUser): Playlist {
  return {
    id: p.id,
    name: p.name,
    ownerName: p.owner.id === me.id ? null : p.owner.display_name,
    artworkUrl: pickImage(p.images),
    total: (p.items ?? p.tracks)?.total ?? null,
    readable: p.owner.id === me.id || p.collaborative,
  }
}

export function toTrack(t: SpotifyTrack): Track {
  // Frozen so Vue skips deep reactivity on what can be thousands of static rows.
  return Object.freeze({
    id: t.is_local ? null : t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album.name,
    artworkUrl: pickImage(t.album.images, 300),
    durationMs: t.duration_ms,
    playable: !t.is_local && t.id !== null,
  })
}

/** Playlist entries can be episodes or removed tracks (null); those are dropped. */
export function playlistEntryToTrack(entry: PlaylistEntry): Track | null {
  const item = entry.item ?? entry.track
  return item?.type === 'track' ? toTrack(item) : null
}

export function savedEntryToTrack(entry: SavedTrackEntry): Track {
  return toTrack(entry.track)
}
