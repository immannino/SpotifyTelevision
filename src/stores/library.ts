import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import {
  LIKED_SONGS_ID,
  playlistEntryToTrack,
  savedEntryToTrack,
  toPlaylist,
  type Playlist,
  type Track,
} from '@/lib/models'
import { SpotifyApiError } from '@/lib/spotify/api'
import type { SpotifyUser } from '@/lib/spotify/types'
import { useSpotifyApi } from './auth'

type LoadStatus = 'idle' | 'loading' | 'done' | 'error'

export interface TrackList {
  tracks: Track[]
  /** Entries Spotify reports, including episodes and removed tracks we drop. */
  total: number | null
  fetched: number
  status: LoadStatus
  error: string | null
}

export const useLibraryStore = defineStore('library', () => {
  const api = useSpotifyApi()

  const user = ref<SpotifyUser | null>(null)
  const playlists = ref<Playlist[]>([])
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const lists = reactive<Record<string, TrackList>>({})

  /** Loads the profile, then streams every playlist page into the sidebar as it arrives. */
  async function loadLibrary() {
    if (status.value === 'loading' || status.value === 'done') return
    status.value = 'loading'
    error.value = null
    try {
      const me = await api.getMe()
      user.value = me
      playlists.value = [
        { id: LIKED_SONGS_ID, name: 'Liked Songs', ownerName: null, artworkUrl: null, total: null, readable: true },
      ]
      for await (const page of api.myPlaylists()) {
        playlists.value.push(...page.items.filter((p) => p).map((p) => toPlaylist(p, me)))
      }
      status.value = 'done'
    } catch (err) {
      status.value = 'error'
      error.value =
        err instanceof SpotifyApiError && err.status === 403
          ? "This Spotify account isn't enabled for the app yet. While the app is in development mode, the owner has to add you in the Spotify developer dashboard."
          : describeError(err)
    }
  }

  function trackList(playlistId: string): TrackList {
    // Re-read after assigning: `??=` would hand back the raw object, not the reactive proxy.
    lists[playlistId] ??= { tracks: [], total: null, fetched: 0, status: 'idle', error: null }
    return lists[playlistId]
  }

  /** Fetches a playlist's songs on first expand, paginating in the background. */
  async function loadTracks(playlistId: string) {
    const list = trackList(playlistId)
    if (list.status === 'loading' || list.status === 'done') return
    Object.assign(list, { tracks: [], total: null, fetched: 0, status: 'loading', error: null })

    try {
      if (playlistId === LIKED_SONGS_ID) {
        for await (const page of api.likedSongs()) {
          list.total = page.total
          list.fetched += page.items.length
          list.tracks.push(...page.items.map(savedEntryToTrack))
        }
        const liked = playlists.value.find((p) => p.id === LIKED_SONGS_ID)
        if (liked) liked.total = list.total
      } else {
        for await (const page of api.playlistItems(playlistId)) {
          list.total = page.total
          list.fetched += page.items.length
          list.tracks.push(...page.items.map(playlistEntryToTrack).filter((t) => t !== null))
        }
      }
      list.status = 'done'
    } catch (err) {
      list.status = 'error'
      list.error =
        err instanceof SpotifyApiError && err.status === 403
          ? "Spotify doesn't share the songs in playlists you don't own or collaborate on."
          : describeError(err)
    }
  }

  function reset() {
    user.value = null
    playlists.value = []
    status.value = 'idle'
    error.value = null
    for (const key of Object.keys(lists)) delete lists[key]
  }

  return { user, playlists, status, error, lists, loadLibrary, loadTracks, trackList, reset }
})

function describeError(err: unknown): string {
  if (err instanceof SpotifyApiError) return err.message
  if (err instanceof TypeError) return "Couldn't reach Spotify. Check your connection."
  return err instanceof Error ? err.message : 'Something went wrong.'
}
