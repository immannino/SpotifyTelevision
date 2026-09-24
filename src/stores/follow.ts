// "Follow Spotify" mode: play music in any Spotify app (phone, desktop, a speaker) and the
// video follows along, muted, at the same position. Polls Spotify's playback state and
// applies the decisions from lib/follow.ts to the player store, locally or on a cast TV.
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { nextPollDelay, planSync, toSnapshot, type SpotifySnapshot } from '@/lib/follow'
import { toTrack } from '@/lib/models'
import { beginLogin } from '@/lib/spotify/auth'
import { SpotifyApiError, type PlayerCommand } from '@/lib/spotify/api'
import { useAuthStore, useSpotifyApi } from './auth'
import { usePlayerStore } from './player'

const SCOPE = 'user-read-playback-state'
/** Needed only for the playback controls (and Spotify also requires Premium for them). */
const CONTROL_SCOPE = 'user-modify-playback-state'
/** After a command, re-check Spotify quickly a few times so the change shows up promptly. */
const COMMAND_POLL_DELAYS_MS = [350, 900, 1800]
const PREF_KEY = 'stv:follow'
/** Seek when the video is further than this from Spotify's position. */
const DRIFT_TOLERANCE_S = 2.5
/** Casting adds a relay hop to every command and status, so allow more slack. */
const CAST_DRIFT_TOLERANCE_S = 4
const ERROR_RETRY_MS = 15_000

export type FollowStatus = 'off' | 'needs-permission' | 'starting' | 'waiting' | 'playing' | 'paused' | 'error'

export const useFollowStore = defineStore('follow', () => {
  const auth = useAuthStore()
  const api = useSpotifyApi()
  const player = usePlayerStore()

  const status = ref<FollowStatus>('off')
  /** The Spotify Connect device playing, e.g. "Tony's MacBook". */
  const device = ref<string | null>(null)
  const error = ref<string | null>(null)
  const active = computed(() => player.mode === 'follow')

  const controlError = ref<string | null>(null)
  const premiumRequired = ref(false)
  const needsControlPermission = computed(() => active.value && !auth.hasScope(CONTROL_SCOPE))
  const canControl = computed(() => active.value && auth.hasScope(CONTROL_SCOPE) && !premiumRequired.value)

  let timer: ReturnType<typeof setTimeout> | undefined
  let polling = false
  let quickPolls: number[] = []
  let controlErrorTimer: ReturnType<typeof setTimeout> | undefined

  // Leaving follow mode happens in the player store too (picking a song in the sidebar),
  // so cleanup keys off the mode rather than off stop().
  watch(active, (isActive) => {
    if (isActive) return
    clearTimeout(timer)
    // Runs after poll() may have set needs-permission; keep that so the UI can offer the fix.
    if (status.value !== 'needs-permission') status.value = 'off'
    device.value = null
    localStorage.removeItem(PREF_KEY)
  })

  function start() {
    error.value = null
    if (!auth.hasScope(SCOPE)) {
      status.value = 'needs-permission'
      return
    }
    player.enterFollowMode()
    localStorage.setItem(PREF_KEY, '1')
    status.value = 'starting'
    schedule(0)
  }

  function stop() {
    player.leaveFollowMode()
    if (status.value === 'needs-permission') status.value = 'off'
  }

  function toggle() {
    if (active.value) stop()
    else start()
  }

  /** Logs in again to grant the playback-state permission, then resumes following. */
  function grantPermission() {
    localStorage.setItem(PREF_KEY, '1')
    void beginLogin()
  }

  /** Picks follow mode back up after a reload or the permission login. */
  function resume() {
    if (localStorage.getItem(PREF_KEY) && !active.value) start()
  }

  /** Sends a command to whatever Spotify device is playing. */
  async function control(command: PlayerCommand) {
    if (!canControl.value) return
    controlError.value = null
    // Instant feedback on the video; the next poll confirms what Spotify actually did.
    if (command === 'pause') {
      player.pause()
      status.value = 'paused'
    } else if (command === 'play') {
      player.play()
      status.value = 'playing'
    }
    try {
      await api.playerCommand(command)
    } catch (err) {
      if (err instanceof SpotifyApiError && err.reason === 'PREMIUM_REQUIRED') {
        premiumRequired.value = true
        showControlError('Controlling playback needs Spotify Premium. Following still works.')
      } else if (err instanceof SpotifyApiError && (err.reason === 'NO_ACTIVE_DEVICE' || err.status === 404)) {
        showControlError('No active Spotify device. Start playing in a Spotify app first.')
      } else {
        showControlError(err instanceof Error ? err.message : "Couldn't reach Spotify.")
      }
    }
    // Resync either way: after success to pick up the change, after failure to undo the
    // optimistic play/pause.
    quickPolls = [...COMMAND_POLL_DELAYS_MS]
    schedule(quickPolls.shift()!)
  }

  function togglePlay() {
    void control(status.value === 'playing' ? 'pause' : 'play')
  }

  function showControlError(message: string) {
    controlError.value = message
    clearTimeout(controlErrorTimer)
    controlErrorTimer = setTimeout(() => (controlError.value = null), 6000)
  }

  function schedule(delay: number) {
    clearTimeout(timer)
    timer = setTimeout(poll, delay)
  }

  async function poll() {
    if (!active.value || polling) return
    polling = true
    const requestedAt = Date.now()
    let snapshot: SpotifySnapshot | null = null
    try {
      const state = await api.playbackState()
      if (!active.value) return
      snapshot = toSnapshot(state, Date.now() - requestedAt)
      device.value = state?.device.name ?? null
      status.value = !snapshot.trackId ? 'waiting' : snapshot.playing ? 'playing' : 'paused'
      error.value = null

      const tolerance = player.isCasting ? CAST_DRIFT_TOLERANCE_S : DRIFT_TOLERANCE_S
      for (const action of planSync(snapshot, player.videoSnapshot(), tolerance)) {
        if (action.type === 'load' && state?.item?.type === 'track') {
          void player.followLoad(toTrack(state.item), action.at, action.autoplay)
        } else if (action.type === 'seek') {
          player.seekTo(action.at)
        } else if (action.type === 'play') {
          player.play()
        } else if (action.type === 'pause') {
          player.pause()
        }
      }
    } catch (err) {
      if (!active.value) return
      if (err instanceof SpotifyApiError && (err.status === 401 || err.status === 403)) {
        // Most likely the token predates the playback permission.
        player.leaveFollowMode()
        status.value = 'needs-permission'
        return
      }
      status.value = 'error'
      error.value = err instanceof Error ? err.message : "Couldn't reach Spotify."
    } finally {
      polling = false
    }
    if (!active.value) return
    const quick = quickPolls.shift()
    schedule(quick ?? (snapshot ? nextPollDelay(snapshot, document.visibilityState === 'visible') : ERROR_RETRY_MS))
  }

  // Check right away when the tab comes back, instead of waiting out the hidden-tab delay.
  document.addEventListener('visibilitychange', () => {
    if (active.value && document.visibilityState === 'visible') schedule(0)
  })

  return {
    status,
    device,
    error,
    active,
    controlError,
    canControl,
    needsControlPermission,
    premiumRequired,
    start,
    stop,
    toggle,
    control,
    togglePlay,
    grantPermission,
    resume,
  }
})
