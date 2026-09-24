import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Track } from '@/lib/models'
import type { PlaybackState, VideoPlayer, VideoPlayerEvents } from '@/lib/player/types'
import { advance, buildOrder, extendOrder, nextRepeatMode, type RepeatMode } from '@/lib/queue'
import { LookupError, lookupVideos, type VideoCandidate } from '@/lib/video-lookup'
import { useAuthStore } from './auth'
import { useLibraryStore } from './library'

const PREFS_KEY = 'stv:player-prefs'
/** How long a "no video found" message stays up before skipping to the next song. */
const AUTO_SKIP_MS = 2500
/** Past this point, "previous" restarts the current song instead of going back. */
const RESTART_THRESHOLD_S = 3

export type VideoStatus =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'ready'; candidates: VideoCandidate[]; index: number }
  | { kind: 'error'; message: string }

export const usePlayerStore = defineStore('player', () => {
  const auth = useAuthStore()
  const library = useLibraryStore()
  const prefs = readPrefs()

  const playlistId = ref<string | null>(null)
  const order = ref<number[]>([])
  const position = ref(-1)
  const shuffle = ref(prefs.shuffle)
  const repeat = ref<RepeatMode>(prefs.repeat)
  const playback = ref<PlaybackState>('unstarted')
  const video = ref<VideoStatus>({ kind: 'idle' })

  const tracks = computed<Track[]>(() => (playlistId.value ? (library.lists[playlistId.value]?.tracks ?? []) : []))
  const currentIndex = computed(() => order.value[position.value] ?? -1)
  const currentTrack = computed(() => tracks.value[currentIndex.value] ?? null)
  const currentVideo = computed(() => (video.value.kind === 'ready' ? video.value.candidates[video.value.index] : null))
  const isPlaying = computed(() => playback.value === 'playing' || playback.value === 'buffering')

  watch([shuffle, repeat], () => localStorage.setItem(PREFS_KEY, JSON.stringify({ shuffle: shuffle.value, repeat: repeat.value })))

  // The playing playlist can still be paginating; fold new songs into the queue as they land.
  watch(
    () => tracks.value.length,
    (length) => (order.value = extendOrder(order.value, length, shuffle.value)),
  )

  let player: VideoPlayer | null = null
  let requestId = 0
  let skipTimer: ReturnType<typeof setTimeout> | undefined

  const playerEvents: VideoPlayerEvents = {
    onStateChange(state) {
      playback.value = state
      if (state === 'ended') next({ auto: true })
    },
    onError(kind) {
      if (kind === 'unavailable') tryNextCandidate()
    },
  }

  function attachPlayer(p: VideoPlayer) {
    player = p
    if (currentVideo.value) p.load(currentVideo.value.id)
  }

  function detachPlayer() {
    player = null
    playback.value = 'unstarted'
  }

  async function playAt(pos: number) {
    clearTimeout(skipTimer)
    position.value = pos
    const track = currentTrack.value
    if (!track?.id) return

    // Guards against a slow lookup resolving after the user has moved on to another song.
    const id = ++requestId
    video.value = { kind: 'searching' }
    try {
      const candidates = await lookupVideos(track.id, await auth.getAccessToken())
      if (id !== requestId) return
      video.value = { kind: 'ready', candidates, index: 0 }
      player?.load(candidates[0]!.id)
    } catch (err) {
      if (id !== requestId) return
      const message = err instanceof Error ? err.message : 'Video lookup failed.'
      video.value = { kind: 'error', message }
      // Keep the show going past songs without a video; stop on anything systemic.
      if (err instanceof LookupError && err.kind === 'not-found') scheduleSkip()
    }
  }

  function tryNextCandidate() {
    const v = video.value
    if (v.kind !== 'ready') return
    if (v.index + 1 < v.candidates.length) {
      video.value = { ...v, index: v.index + 1 }
      player?.load(v.candidates[v.index + 1]!.id)
    } else {
      video.value = { kind: 'error', message: "None of the matching videos can be embedded." }
      scheduleSkip()
    }
  }

  function scheduleSkip() {
    skipTimer = setTimeout(() => next({ auto: true }), AUTO_SKIP_MS)
  }

  function playFrom(id: string, trackIndex: number) {
    playlistId.value = id
    order.value = buildOrder(tracks.value.length, shuffle.value, trackIndex)
    void playAt(shuffle.value ? 0 : trackIndex)
  }

  function step(direction: 1 | -1) {
    return advance({
      order: order.value,
      position: position.value,
      direction,
      repeat: repeat.value,
      isPlayable: (i) => tracks.value[i]?.playable ?? false,
    })
  }

  function next({ auto = false } = {}) {
    if (auto && repeat.value === 'one' && player && currentVideo.value) {
      player.seekTo(0)
      player.play()
      return
    }
    const pos = step(1)
    if (pos === null) {
      clearTimeout(skipTimer)
      return
    }
    void playAt(pos)
  }

  function previous() {
    if (player && currentVideo.value && player.currentTime() > RESTART_THRESHOLD_S) {
      player.seekTo(0)
      return
    }
    const pos = step(-1)
    if (pos === null) player?.seekTo(0)
    else void playAt(pos)
  }

  function togglePlay() {
    if (!player || !currentVideo.value) return
    if (isPlaying.value) player.pause()
    else player.play()
  }

  function toggleShuffle() {
    shuffle.value = !shuffle.value
    const index = currentIndex.value
    if (index < 0) return
    order.value = buildOrder(tracks.value.length, shuffle.value, index)
    position.value = shuffle.value ? 0 : index
  }

  function cycleRepeat() {
    repeat.value = nextRepeatMode(repeat.value)
  }

  function stop() {
    clearTimeout(skipTimer)
    requestId++
    player?.pause()
    playlistId.value = null
    order.value = []
    position.value = -1
    video.value = { kind: 'idle' }
  }

  return {
    playlistId,
    shuffle,
    repeat,
    playback,
    video,
    currentIndex,
    currentTrack,
    currentVideo,
    isPlaying,
    playerEvents,
    attachPlayer,
    detachPlayer,
    playFrom,
    next,
    previous,
    togglePlay,
    toggleShuffle,
    cycleRepeat,
    stop,
  }
})

function readPrefs(): { shuffle: boolean; repeat: RepeatMode } {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<{ shuffle: boolean; repeat: RepeatMode }>
    return {
      shuffle: parsed.shuffle === true,
      repeat: parsed.repeat === 'all' || parsed.repeat === 'one' ? parsed.repeat : 'off',
    }
  } catch {
    return { shuffle: false, repeat: 'off' }
  }
}
