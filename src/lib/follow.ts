// Pure decision logic for "Follow Spotify" mode: someone plays music in any Spotify app,
// and the video follows along, muted, at the same position. Kept free of Vue and timers so
// it can be unit tested; stores/follow.ts does the polling and applies the actions.
import type { PlaybackState } from './spotify/types'

export interface SpotifySnapshot {
  /** Null when nothing we can match is playing: nothing at all, a podcast, an ad, a local file. */
  trackId: string | null
  playing: boolean
  /** Where the song is now, already corrected for request latency. */
  positionSeconds: number
  durationSeconds: number
}

export interface VideoSnapshot {
  /** The Spotify track the loaded video belongs to. */
  trackId: string | null
  playing: boolean
  positionSeconds: number
  /** 0 if unknown. */
  durationSeconds: number
}

export type SyncAction =
  | { type: 'load'; trackId: string; at: number; autoplay: boolean }
  | { type: 'seek'; at: number }
  | { type: 'play' }
  | { type: 'pause' }

/**
 * Turns a playback-state response into a snapshot. Spotify's progress was measured
 * somewhere during the request, so assume the middle of the round trip.
 */
export function toSnapshot(state: PlaybackState | null, roundTripMs: number): SpotifySnapshot {
  const item = state?.item
  if (!state || item?.type !== 'track' || item.is_local || !item.id) {
    return { trackId: null, playing: false, positionSeconds: 0, durationSeconds: 0 }
  }
  const progress = (state.progress_ms ?? 0) / 1000
  return {
    trackId: item.id,
    playing: state.is_playing,
    positionSeconds: state.is_playing ? progress + roundTripMs / 2000 : progress,
    durationSeconds: item.duration_ms / 1000,
  }
}

/** What to do to make the video match Spotify. */
export function planSync(spotify: SpotifySnapshot, video: VideoSnapshot, driftToleranceSeconds: number): SyncAction[] {
  if (!spotify.trackId) return video.playing ? [{ type: 'pause' }] : []

  if (spotify.trackId !== video.trackId) {
    return [{ type: 'load', trackId: spotify.trackId, at: spotify.positionSeconds, autoplay: spotify.playing }]
  }

  // Music videos are often shorter than the audio (or the song runs past the video's end).
  // Once the song is past the video, leave it finished rather than seeking and replaying.
  const pastVideoEnd = video.durationSeconds > 0 && spotify.positionSeconds >= video.durationSeconds - 1
  if (pastVideoEnd) return video.playing ? [{ type: 'pause' }] : []

  if (spotify.playing && !video.playing) return [{ type: 'seek', at: spotify.positionSeconds }, { type: 'play' }]
  if (!spotify.playing && video.playing) return [{ type: 'pause' }]
  if (spotify.playing && Math.abs(video.positionSeconds - spotify.positionSeconds) > driftToleranceSeconds) {
    return [{ type: 'seek', at: spotify.positionSeconds }]
  }
  return []
}

/**
 * How long to wait before asking Spotify again: often while playing (and right as the
 * current song should end, so the next video starts promptly), rarely when idle or hidden.
 */
export function nextPollDelay(spotify: SpotifySnapshot, pageVisible: boolean): number {
  if (!pageVisible) return 15_000
  if (!spotify.trackId) return 5_000
  if (!spotify.playing) return 4_000
  const untilEndMs = (spotify.durationSeconds - spotify.positionSeconds) * 1000 + 400
  return Math.max(1_000, Math.min(4_000, untilEndMs))
}
