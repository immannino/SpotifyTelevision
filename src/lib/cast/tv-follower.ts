// TV-side "Follow Spotify": with its own Spotify login, the TV polls what's playing and keeps
// the video in sync by itself, so no phone has to stay awake. The decisions come from
// lib/follow.ts, the same logic the phone uses.
import { nextPollDelay, planSync, toSnapshot, type SpotifySnapshot } from '@/lib/follow'
import { pickImage } from '@/lib/models'
import type { PlaybackState as VideoState, PlayerErrorKind, VideoPlayer } from '@/lib/player/types'
import { SpotifyApiError } from '@/lib/spotify/api'
import type { PlaybackState } from '@/lib/spotify/types'
import type { VideoCandidate } from '@/lib/video-lookup'
import type { CastTrack } from './protocol'

const DRIFT_TOLERANCE_S = 2.5
const ERROR_RETRY_MS = 15_000
/**
 * Consecutive "nothing playing" polls before clearing the screen back to the idle view.
 * More than one, so a momentary gap between songs doesn't flash the idle screen.
 */
const IDLE_AFTER_EMPTY_POLLS = 2

export type FollowerStatus = 'starting' | 'waiting' | 'playing' | 'paused' | 'no-video' | 'error' | 'signed-out'

export interface FollowerDeps {
  playbackState(): Promise<PlaybackState | null>
  lookup(trackId: string): Promise<VideoCandidate[]>
  player: VideoPlayer
  onChange(): void
  pageVisible?: () => boolean
}

export class TvFollower {
  status: FollowerStatus = 'starting'
  track: CastTrack | null = null
  device: string | null = null

  private trackId: string | null = null
  private candidates: VideoCandidate[] = []
  private candidateIndex = 0
  private videoState: VideoState = 'unstarted'
  private last: { snapshot: SpotifySnapshot; at: number } | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private lookupId = 0
  private emptyPolls = 0

  constructor(private readonly deps: FollowerDeps) {}

  get isRunning() {
    return this.running
  }

  /** Spotify ID of the song being shown, for detecting song changes. */
  get currentTrackId() {
    return this.trackId
  }

  start() {
    if (this.running) return
    this.running = true
    this.status = 'starting'
    this.deps.player.setMuted(true)
    this.schedule(0)
    this.deps.onChange()
  }

  stop() {
    this.running = false
    clearTimeout(this.timer)
    this.lookupId++
    this.trackId = null
    this.track = null
    this.deps.player.pause()
    this.deps.onChange()
  }

  /** Check Spotify now, e.g. when the page becomes visible again. */
  pollNow() {
    if (this.running) this.schedule(0)
  }

  onPlayerState(state: VideoState) {
    this.videoState = state
  }

  onPlayerError(kind: PlayerErrorKind) {
    if (kind !== 'unavailable' || this.candidateIndex + 1 >= this.candidates.length) {
      this.status = 'no-video'
      this.deps.onChange()
      return
    }
    this.candidateIndex++
    this.deps.player.load(this.candidates[this.candidateIndex]!.id, this.expectedPosition())
  }

  async poll() {
    if (!this.running) return
    const requestedAt = Date.now()
    let snapshot: SpotifySnapshot | null = null
    try {
      const state = await this.deps.playbackState()
      if (!this.running) return
      snapshot = toSnapshot(state, Date.now() - requestedAt)
      this.last = { snapshot, at: Date.now() }
      this.device = state?.device.name ?? null
      if (this.status !== 'no-video' || snapshot.trackId !== this.trackId) {
        this.status = !snapshot.trackId ? 'waiting' : snapshot.playing ? 'playing' : 'paused'
      }

      this.emptyPolls = snapshot.trackId ? 0 : this.emptyPolls + 1
      if (this.emptyPolls >= IDLE_AFTER_EMPTY_POLLS && this.trackId) {
        this.lookupId++
        this.trackId = null
        this.track = null
      }

      for (const action of planSync(snapshot, this.videoSnapshot(), DRIFT_TOLERANCE_S)) {
        if (action.type === 'load' && state?.item?.type === 'track') {
          void this.load(state.item.id!, toCastTrack(state), action.at, action.autoplay)
        } else if (action.type === 'seek') {
          this.deps.player.seekTo(action.at)
        } else if (action.type === 'play') {
          this.deps.player.play()
        } else if (action.type === 'pause') {
          this.deps.player.pause()
        }
      }
    } catch (err) {
      if (!this.running) return
      if (err instanceof SpotifyApiError && (err.status === 401 || err.status === 403)) {
        this.status = 'signed-out'
        this.stop()
        return
      }
      this.status = 'error'
    }
    this.deps.onChange()
    if (!this.running) return
    const visible = this.deps.pageVisible?.() ?? true
    this.schedule(snapshot ? nextPollDelay(snapshot, visible) : ERROR_RETRY_MS)
  }

  private async load(trackId: string, track: CastTrack, at: number, autoplay: boolean) {
    // Recorded before the lookup so the next poll doesn't start a second one.
    this.trackId = trackId
    this.track = track
    this.candidates = []
    this.candidateIndex = 0
    const id = ++this.lookupId
    const requestedAt = Date.now()
    try {
      const candidates = await this.deps.lookup(trackId)
      if (id !== this.lookupId || !this.running) return
      this.candidates = candidates
      // The song kept playing during the lookup.
      const start = at + (autoplay ? (Date.now() - requestedAt) / 1000 : 0)
      this.deps.player.load(candidates[0]!.id, start)
      if (!autoplay) this.deps.player.pause()
    } catch {
      if (id !== this.lookupId) return
      this.status = 'no-video'
      this.deps.player.pause()
    }
    this.deps.onChange()
  }

  private videoSnapshot() {
    return {
      trackId: this.trackId,
      playing: this.videoState === 'playing' || this.videoState === 'buffering',
      positionSeconds: this.deps.player.currentTime(),
      durationSeconds: this.deps.player.duration(),
    }
  }

  private expectedPosition(): number {
    if (!this.last) return 0
    const { snapshot, at } = this.last
    return snapshot.positionSeconds + (snapshot.playing ? (Date.now() - at) / 1000 : 0)
  }

  private schedule(delay: number) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.poll(), delay)
  }
}

function toCastTrack(state: PlaybackState): CastTrack {
  const item = state.item as Extract<PlaybackState['item'], { type: 'track' }>
  return {
    name: item.name,
    artists: item.artists.map((a) => a.name),
    album: item.album.name,
    artworkUrl: pickImage(item.album.images, 300),
  }
}
