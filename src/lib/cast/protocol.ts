// Messages exchanged between a phone ("remote") and a TV through a Worker room.
// The Worker relays them verbatim (see worker/src/room.ts).
//
// The phone owns the queue: shuffle, repeat and Spotify access all live there. It sends the
// TV the current song plus a few upcoming ones with their videos already resolved, so the
// TV can keep playing on its own while the phone is locked or asleep. The TV reports which
// of those items it's on, and the phone catches up and tops up the queue when it wakes.
import type { PlaybackState } from '@/lib/player/types'
import type { VideoCandidate } from '@/lib/video-lookup'

export interface CastTrack {
  name: string
  artists: string[]
  album: string
  artworkUrl: string | null
}

export interface CastItem {
  /** Identifies a queue position, so a re-sent queue doesn't restart the current video. */
  key: string
  track: CastTrack
  candidates: VideoCandidate[]
}

export interface QueueMessage {
  type: 'queue'
  /** Increases with every queue the phone sends; status reports echo it. */
  seq: number
  /** items[0] is the current song; the rest play in order after it. */
  items: CastItem[]
  /** Replay items[0] when it ends (repeat one). */
  loop: boolean
  /** Reload items[0] even if it's already playing (the user picked it again). */
  restart: boolean
  /** Where to start items[0] when (re)loading it, e.g. when handing off from the phone. */
  startSeconds?: number
  /** Silence the TV, e.g. when following Spotify, which provides the audio itself. */
  muted: boolean
}

export type CommandMessage =
  | { type: 'command'; command: 'play' | 'pause' }
  | { type: 'command'; command: 'seek'; seconds: number }

export interface StatusMessage {
  type: 'status'
  /** The queue `seq` this status refers to. */
  seq: number
  /** Index into that queue's items; -1 when nothing is loaded. */
  index: number
  /** 'failing': several videos in a row wouldn't play, so the TV stopped rather than skip on. */
  state: PlaybackState | 'idle' | 'failing'
  currentTime: number
  /** Length of the current video in seconds; 0 if unknown. */
  duration: number
  item: CastItem | null
}

/** Sent by the Worker whenever someone joins or leaves. */
export interface PresenceMessage {
  type: 'presence'
  tv: boolean
  remotes: number
}

export type RemoteMessage = QueueMessage | CommandMessage
export type TvMessage = StatusMessage
export type IncomingForRemote = StatusMessage | PresenceMessage
export type IncomingForTv = RemoteMessage | PresenceMessage
