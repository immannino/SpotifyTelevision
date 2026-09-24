import { onBeforeUnmount, watch } from 'vue'
import { useFollowStore } from '@/stores/follow'
import { usePlayerStore } from '@/stores/player'

/**
 * Publishes the current song to the OS media UI (lock screen, media keys) and routes its
 * controls back to the player. Browser support varies, and since the audio comes from a
 * cross-origin iframe some platforms may not show it.
 */
export function useMediaSession() {
  if (!('mediaSession' in navigator)) return
  const player = usePlayerStore()
  const follow = useFollowStore()
  const session = navigator.mediaSession

  watch(
    () => player.currentTrack,
    (track) => {
      session.metadata = track
        ? new MediaMetadata({
            title: track.name,
            artist: track.artists.join(', '),
            album: track.album,
            artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: '300x300' }] : [],
          })
        : null
    },
    { immediate: true },
  )
  watch(
    () => player.isPlaying,
    (playing) => (session.playbackState = player.currentTrack ? (playing ? 'playing' : 'paused') : 'none'),
  )

  const actions: [MediaSessionAction, () => void][] = [
    ['play', () => (follow.active ? void follow.control('play') : player.togglePlay())],
    ['pause', () => (follow.active ? void follow.control('pause') : player.togglePlay())],
    ['nexttrack', () => (follow.active ? void follow.control('next') : player.next())],
    ['previoustrack', () => (follow.active ? void follow.control('previous') : player.previous())],
  ]
  for (const [action, handler] of actions) session.setActionHandler(action, handler)

  onBeforeUnmount(() => {
    for (const [action] of actions) session.setActionHandler(action, null)
    session.metadata = null
  })
}
