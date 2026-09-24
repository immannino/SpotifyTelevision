import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import type { CastItem, IncomingForRemote, RemoteMessage, StatusMessage } from '@/lib/cast/protocol'
import { openRoomSocket, type RoomSocket } from '@/lib/cast/socket'
import type { Track } from '@/lib/models'
import type { PlaybackState, VideoPlayer, VideoPlayerEvents } from '@/lib/player/types'
import { advance, buildOrder, extendOrder, nextRepeatMode, type RepeatMode } from '@/lib/queue'
import { LookupError, lookupVideos, type VideoCandidate } from '@/lib/video-lookup'
import { useAuthStore } from './auth'
import { useLibraryStore } from './library'

const PREFS_KEY = 'stv:player-prefs'
const CAST_KEY = 'stv:cast'
/** How long a "no video found" message stays up before skipping to the next song. */
const AUTO_SKIP_MS = 2500
/** Past this point, "previous" restarts the current song instead of going back. */
const RESTART_THRESHOLD_S = 3
/** Songs sent to the TV beyond the current one, so it keeps playing while the phone sleeps. */
const CAST_UP_NEXT = 3
/**
 * Delay before acting on TV status. A waking phone receives a burst of queued statuses;
 * acting on the first would rewind the TV to where it was when the phone fell asleep.
 */
const CATCH_UP_DELAY_MS = 150

export type VideoStatus =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'ready'; candidates: VideoCandidate[]; index: number }
  | { kind: 'error'; message: string }

/** off → connecting → waiting-for-tv / connected; reconnecting while the socket is down. */
export type CastState = 'off' | 'connecting' | 'waiting-for-tv' | 'connected'

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

  // --- Casting state -------------------------------------------------------------------

  const castCode = ref<string | null>(null)
  const castState = ref<CastState>('off')
  const castError = ref<string | null>(null)
  /** What the TV says it's playing; survives a phone reload that lost the local queue. */
  const tvItem = shallowRef<CastItem | null>(null)
  /** The TV gave up after several videos in a row wouldn't play there. */
  const tvFailing = ref(false)
  const isCasting = computed(() => castCode.value !== null)

  let socket: RoomSocket<RemoteMessage> | null = null
  let castSeq = Date.now()
  /** For recent queues: seq → queue position of each item, by item index. */
  const sentQueues = new Map<number, number[]>()
  let latestStatus: StatusMessage | null = null
  /** Seq of the last queue that changed the song at the user's request. */
  let lastRestartSeq = 0
  let catchUpTimer: ReturnType<typeof setTimeout> | undefined
  let lastTvTime = { seconds: 0, receivedAt: 0 }

  // --- Local player --------------------------------------------------------------------

  const playerEvents: VideoPlayerEvents = {
    onStateChange(state) {
      if (isCasting.value) return
      playback.value = state
      if (state === 'ended') next({ auto: true })
    },
    onError(kind) {
      if (!isCasting.value && kind === 'unavailable') tryNextCandidate()
    },
  }

  function attachPlayer(p: VideoPlayer) {
    player = p
    if (currentVideo.value && !isCasting.value) p.load(currentVideo.value.id)
  }

  function detachPlayer() {
    player = null
    if (!isCasting.value) playback.value = 'unstarted'
  }

  // --- Queue ---------------------------------------------------------------------------

  function resolve(track: Track): Promise<VideoCandidate[]> {
    return auth.getAccessToken().then((token) => lookupVideos(track.id!, token))
  }

  async function playAt(pos: number, { restart = true, startSeconds }: { restart?: boolean; startSeconds?: number } = {}) {
    clearTimeout(skipTimer)
    position.value = pos
    const track = currentTrack.value
    if (!track?.id) return

    // Guards against a slow lookup resolving after the user has moved on to another song.
    const id = ++requestId
    video.value = { kind: 'searching' }
    try {
      const candidates = await resolve(track)
      if (id !== requestId) return
      video.value = { kind: 'ready', candidates, index: 0 }
      if (isCasting.value) void sendQueue(id, candidates, restart, startSeconds)
      else player?.load(candidates[0]!.id, startSeconds)
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
      video.value = { kind: 'error', message: 'None of the matching videos can be embedded.' }
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

  function step(direction: 1 | -1, from = position.value) {
    return advance({
      order: order.value,
      position: from,
      direction,
      repeat: repeat.value,
      isPlayable: (i) => tracks.value[i]?.playable ?? false,
    })
  }

  function next({ auto = false } = {}) {
    if (auto && repeat.value === 'one' && player && currentVideo.value && !isCasting.value) {
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
    if (currentTime() > RESTART_THRESHOLD_S) {
      seekTo(0)
      return
    }
    const pos = step(-1)
    if (pos === null) seekTo(0)
    else void playAt(pos)
  }

  function togglePlay() {
    if (isCasting.value) {
      socket?.send({ type: 'command', command: isPlaying.value ? 'pause' : 'play' })
      return
    }
    if (!player || !currentVideo.value) return
    if (isPlaying.value) player.pause()
    else player.play()
  }

  function seekTo(seconds: number) {
    if (isCasting.value) socket?.send({ type: 'command', command: 'seek', seconds })
    else if (currentVideo.value) player?.seekTo(seconds)
  }

  function currentTime(): number {
    if (!isCasting.value) return currentVideo.value && player ? player.currentTime() : 0
    const elapsed = playback.value === 'playing' ? (Date.now() - lastTvTime.receivedAt) / 1000 : 0
    return lastTvTime.seconds + elapsed
  }

  function toggleShuffle() {
    shuffle.value = !shuffle.value
    const index = currentIndex.value
    if (index < 0) return
    order.value = buildOrder(tracks.value.length, shuffle.value, index)
    position.value = shuffle.value ? 0 : index
    refreshTvQueue()
  }

  function cycleRepeat() {
    repeat.value = nextRepeatMode(repeat.value)
    refreshTvQueue()
  }

  function stop() {
    disconnectTv({ handOff: false })
    clearTimeout(skipTimer)
    requestId++
    player?.pause()
    playlistId.value = null
    order.value = []
    position.value = -1
    video.value = { kind: 'idle' }
  }

  // --- Casting -------------------------------------------------------------------------

  function toCastItem(pos: number, candidates: VideoCandidate[]): CastItem {
    const index = order.value[pos]!
    const track = tracks.value[index]!
    return {
      key: `${playlistId.value}:${index}`,
      track: { name: track.name, artists: track.artists, album: track.album, artworkUrl: track.artworkUrl },
      candidates,
    }
  }

  /**
   * Sends the TV the current song right away, then again with the upcoming songs once
   * their videos are resolved (usually from cache). The TV keeps playing the current video
   * across the second send because its key hasn't changed.
   */
  async function sendQueue(id: number, current: VideoCandidate[], restart: boolean, startSeconds?: number) {
    const send = (items: { pos: number; candidates: VideoCandidate[] }[], restartNow: boolean) => {
      sentQueues.set(++castSeq, items.map((i) => i.pos))
      if (restartNow) lastRestartSeq = castSeq
      if (sentQueues.size > 20) sentQueues.delete(sentQueues.keys().next().value!)
      socket?.send({
        type: 'queue',
        seq: castSeq,
        items: items.map((i) => toCastItem(i.pos, i.candidates)),
        loop: repeat.value === 'one',
        restart: restartNow,
        startSeconds: restartNow ? startSeconds : undefined,
      })
    }

    const head = { pos: position.value, candidates: current }
    send([head], restart)

    const upcoming: number[] = []
    for (let p: number | null = position.value; upcoming.length < CAST_UP_NEXT; ) {
      p = step(1, p)
      if (p === null || p === position.value || upcoming.includes(p)) break
      upcoming.push(p)
    }
    const resolved = await Promise.all(
      upcoming.map((pos) =>
        resolve(tracks.value[order.value[pos]!]!).then(
          (candidates) => ({ pos, candidates }),
          () => null, // No video: leave it out; the TV skips straight past it.
        ),
      ),
    )
    if (id !== requestId || !isCasting.value) return
    send([head, ...resolved.filter((r) => r !== null)], false)
  }

  /** Re-sends the queue after shuffle/repeat changes so the TV's up-next matches. */
  function refreshTvQueue() {
    if (isCasting.value && video.value.kind === 'ready') void sendQueue(requestId, video.value.candidates, false)
  }

  function onTvStatus(status: StatusMessage) {
    tvItem.value = status.item
    lastTvTime = { seconds: status.currentTime, receivedAt: Date.now() }
    playback.value = status.state === 'idle' || status.state === 'failing' ? 'unstarted' : status.state
    tvFailing.value = status.state === 'failing'

    latestStatus = status
    clearTimeout(catchUpTimer)
    catchUpTimer = setTimeout(catchUpWithTv, CATCH_UP_DELAY_MS)
  }

  /**
   * If the TV moved ahead on its own (songs ended while we weren't driving), move our
   * position to match and send a fresh queue so it doesn't run out.
   */
  function catchUpWithTv() {
    const status = latestStatus
    // Statuses from before the user last picked a song describe a queue they've replaced.
    if (!status || status.index <= 0 || status.seq < lastRestartSeq) return
    const target = sentQueues.get(status.seq)?.[status.index]
    if (target !== undefined && target !== position.value) void playAt(target, { restart: false })
  }

  function connectTv(code: string) {
    disconnectTv({ handOff: false })
    const startSeconds = currentVideo.value ? currentTime() : undefined
    castCode.value = code
    castState.value = 'connecting'
    castError.value = null
    sessionStorage.setItem(CAST_KEY, code)
    player?.pause()

    let tvPresent = false
    let handedOff = false
    const updateState = (open: boolean) => {
      castState.value = !open ? 'connecting' : tvPresent ? 'connected' : 'waiting-for-tv'
    }

    socket = openRoomSocket<IncomingForRemote, RemoteMessage>(code, 'remote', {
      onStatus: (status) => updateState(status === 'open'),
      onOpen() {
        // Hand the current song over on first connect, resuming where the phone was; on
        // reconnects just re-sync without restarting what the TV is playing.
        if (currentTrack.value) {
          void playAt(position.value, handedOff ? { restart: false } : { restart: true, startSeconds })
        }
        handedOff = true
      },
      onMessage(message) {
        if (message.type === 'presence') {
          tvPresent = message.tv
          updateState(true)
        } else if (message.type === 'status') {
          onTvStatus(message)
        }
      },
      onFatal(reason) {
        disconnectTv({ handOff: false })
        castError.value =
          reason === 'unknown-room'
            ? 'No TV is showing that code. Check the code on the TV and try again.'
            : 'The TV started a new session. Enter the new code shown on the TV.'
      },
    })
  }

  /** Stops casting. With handOff, playback continues on this device where the TV was. */
  function disconnectTv({ handOff = true } = {}) {
    if (!socket) return
    const resumeAt = currentTime()
    const wasPlaying = isPlaying.value
    socket.send({ type: 'command', command: 'pause' })
    socket.close()
    socket = null
    clearTimeout(catchUpTimer)
    latestStatus = null
    castCode.value = null
    castState.value = 'off'
    tvItem.value = null
    tvFailing.value = false
    sessionStorage.removeItem(CAST_KEY)
    playback.value = 'unstarted'
    if (handOff && currentVideo.value && player) {
      player.load(currentVideo.value.id, resumeAt)
      if (!wasPlaying) player.pause()
    }
  }

  /** Rejoins the room this tab was casting to before a reload. */
  function resumeCasting() {
    const code = sessionStorage.getItem(CAST_KEY)
    if (code && !socket) connectTv(code)
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
    castCode,
    castState,
    castError,
    tvItem,
    tvFailing,
    isCasting,
    attachPlayer,
    detachPlayer,
    playFrom,
    next,
    previous,
    togglePlay,
    toggleShuffle,
    cycleRepeat,
    stop,
    connectTv,
    disconnectTv,
    resumeCasting,
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
