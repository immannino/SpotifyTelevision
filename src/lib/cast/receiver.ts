// TV-side playback. Plays the queue window the phone sent, moving through it on its own
// (next candidate if a video won't embed, next item when one ends) and reporting where it
// is, so playback continues while the phone sleeps.
import type { PlaybackState, PlayerErrorKind, VideoPlayer } from '@/lib/player/types'
import type { CastItem, IncomingForTv, StatusMessage } from './protocol'

/**
 * Consecutive items that fail to play before giving up. Without this, a TV that can't play
 * YouTube at all would race through the whole playlist, and the phone would spend lookups
 * resolving every song for it.
 */
export const MAX_CONSECUTIVE_FAILURES = 3

export class TvReceiver {
  seq = -1
  items: CastItem[] = []
  index = -1
  state: StatusMessage['state'] = 'idle'
  private candidateIndex = 0
  private failures = 0
  private loop = false
  private player: VideoPlayer | null = null
  private pendingStart: number | undefined

  constructor(
    private readonly send: (message: StatusMessage) => void,
    private readonly onChange: () => void = () => {},
  ) {}

  get current(): CastItem | null {
    return this.items[this.index] ?? null
  }

  attach(player: VideoPlayer) {
    this.player = player
    if (this.current) this.loadCurrent()
  }

  handle(message: IncomingForTv) {
    if (message.type === 'queue') {
      const keepPlaying = !message.restart && this.current !== null && this.current.key === message.items[0]?.key
      this.seq = message.seq
      this.items = message.items
      this.loop = message.loop
      if (keepPlaying) {
        this.index = 0
        this.report()
      } else if (this.items.length) {
        this.failures = 0
        this.pendingStart = message.startSeconds
        this.playIndex(0)
      } else {
        this.index = -1
        this.player?.pause()
        this.state = 'idle'
        this.report()
      }
    } else if (message.type === 'command') {
      if (!this.player || !this.current) return
      if (message.command === 'seek') this.player.seekTo(message.seconds)
      else if (message.command === 'play') this.player.play()
      else this.player.pause()
    }
  }

  /** For the TV's own remote (OK / play-pause key). */
  togglePlay() {
    if (!this.player || !this.current) return
    if (this.state === 'playing' || this.state === 'buffering') this.player.pause()
    else this.player.play()
  }

  onPlayerState(state: PlaybackState) {
    if (!this.current || this.state === 'failing') return
    if (state === 'playing') this.failures = 0
    this.state = state
    if (state === 'ended') {
      if (this.loop && this.player) {
        this.player.seekTo(0)
        this.player.play()
      } else {
        this.advance()
      }
      return
    }
    this.report()
  }

  onPlayerError(kind: PlayerErrorKind) {
    const item = this.current
    if (!item || this.state === 'failing') return
    if (kind === 'unavailable' && this.candidateIndex + 1 < item.candidates.length) {
      this.candidateIndex++
      this.loadCurrent()
    } else if (++this.failures >= MAX_CONSECUTIVE_FAILURES) {
      this.player?.pause()
      this.state = 'failing'
      this.report()
    } else {
      this.advance()
    }
  }

  private advance() {
    if (this.index + 1 < this.items.length) {
      this.playIndex(this.index + 1)
    } else {
      this.state = 'ended'
      this.report()
    }
  }

  private playIndex(index: number) {
    this.index = index
    this.candidateIndex = 0
    this.state = 'buffering'
    this.loadCurrent()
    this.report()
  }

  private loadCurrent() {
    const video = this.current?.candidates[this.candidateIndex]
    if (!video || !this.player) return
    this.player.load(video.id, this.pendingStart)
    this.pendingStart = undefined
  }

  report() {
    this.send({
      type: 'status',
      seq: this.seq,
      index: this.index,
      state: this.state,
      currentTime: this.player?.currentTime() ?? 0,
      item: this.current,
    })
    this.onChange()
  }
}
