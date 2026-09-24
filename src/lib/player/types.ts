// A video surface: the YouTube iframe on this page. The phone's player store drives one
// directly, and on a TV the cast receiver (lib/cast/receiver.ts) drives one.

export type PlaybackState = 'unstarted' | 'buffering' | 'playing' | 'paused' | 'ended'

export type PlayerErrorKind =
  /** The video can't be embedded or was removed; try another candidate. */
  | 'unavailable'
  | 'unknown'

export interface VideoPlayerEvents {
  onStateChange(state: PlaybackState): void
  onError(kind: PlayerErrorKind): void
}

export interface VideoPlayer {
  load(videoId: string, startSeconds?: number): void
  play(): void
  pause(): void
  seekTo(seconds: number): void
  currentTime(): number
  /** Seconds; 0 until the video's metadata has loaded. */
  duration(): number
  setMuted(muted: boolean): void
  destroy(): void
}
