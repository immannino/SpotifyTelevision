// The seam that makes casting possible: the player store drives *a* VideoPlayer and never
// touches the YouTube iframe directly. Today that's LocalYouTubePlayer; a TV/Cast target
// would be another implementation that relays these same commands and events.

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
  load(videoId: string): void
  play(): void
  pause(): void
  seekTo(seconds: number): void
  currentTime(): number
  destroy(): void
}
