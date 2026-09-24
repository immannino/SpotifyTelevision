import { describe, expect, it } from 'vitest'
import { nextPollDelay, planSync, toSnapshot, type SpotifySnapshot, type VideoSnapshot } from './follow'
import type { PlaybackState, SpotifyTrack } from './spotify/types'

const track = (overrides: Partial<SpotifyTrack> = {}): SpotifyTrack => ({
  type: 'track',
  id: 'track1',
  name: 'Song',
  duration_ms: 200_000,
  is_local: false,
  artists: [{ id: 'a', name: 'Artist' }],
  album: { name: 'Album', images: [] },
  ...overrides,
})

const state = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  device: { id: 'd', name: 'Laptop', type: 'Computer', is_active: true },
  is_playing: true,
  progress_ms: 60_000,
  currently_playing_type: 'track',
  item: track(),
  ...overrides,
})

const spotify = (overrides: Partial<SpotifySnapshot> = {}): SpotifySnapshot => ({
  trackId: 'track1',
  playing: true,
  positionSeconds: 60,
  durationSeconds: 200,
  ...overrides,
})

const video = (overrides: Partial<VideoSnapshot> = {}): VideoSnapshot => ({
  trackId: 'track1',
  playing: true,
  positionSeconds: 60,
  durationSeconds: 210,
  ...overrides,
})

describe('toSnapshot', () => {
  it('corrects a playing position by half the round trip', () => {
    expect(toSnapshot(state(), 400)).toEqual({ trackId: 'track1', playing: true, positionSeconds: 60.2, durationSeconds: 200 })
  })

  it('does not advance a paused position', () => {
    expect(toSnapshot(state({ is_playing: false }), 400).positionSeconds).toBe(60)
  })

  it('treats nothing playing, podcasts and local files as nothing to match', () => {
    expect(toSnapshot(null, 0).trackId).toBeNull()
    expect(toSnapshot(state({ item: { type: 'episode', id: 'e', name: 'Pod' } }), 0).trackId).toBeNull()
    expect(toSnapshot(state({ item: track({ is_local: true, id: null }) }), 0).trackId).toBeNull()
  })
})

describe('planSync', () => {
  it('loads the video for a new song at Spotify’s position', () => {
    expect(planSync(spotify({ trackId: 'track2', positionSeconds: 3 }), video(), 2.5)).toEqual([
      { type: 'load', trackId: 'track2', at: 3, autoplay: true },
    ])
  })

  it('loads paused when Spotify is paused', () => {
    expect(planSync(spotify({ trackId: 'track2', playing: false }), video({ trackId: null, playing: false }), 2.5)).toEqual([
      { type: 'load', trackId: 'track2', at: 60, autoplay: false },
    ])
  })

  it('does nothing when in sync', () => {
    expect(planSync(spotify(), video({ positionSeconds: 61.5 }), 2.5)).toEqual([])
  })

  it('seeks when the video drifts past the tolerance (e.g. after scrubbing in Spotify)', () => {
    expect(planSync(spotify({ positionSeconds: 120 }), video(), 2.5)).toEqual([{ type: 'seek', at: 120 }])
  })

  it('follows pause and resume', () => {
    expect(planSync(spotify({ playing: false }), video(), 2.5)).toEqual([{ type: 'pause' }])
    expect(planSync(spotify({ positionSeconds: 75 }), video({ playing: false }), 2.5)).toEqual([
      { type: 'seek', at: 75 },
      { type: 'play' },
    ])
  })

  it('leaves a finished video alone while the song plays on past it', () => {
    expect(planSync(spotify({ positionSeconds: 190 }), video({ playing: false, durationSeconds: 180 }), 2.5)).toEqual([])
    expect(planSync(spotify({ positionSeconds: 190 }), video({ playing: true, durationSeconds: 180 }), 2.5)).toEqual([
      { type: 'pause' },
    ])
  })

  it('pauses the video when Spotify stops or plays something unmatchable', () => {
    expect(planSync(spotify({ trackId: null }), video(), 2.5)).toEqual([{ type: 'pause' }])
    expect(planSync(spotify({ trackId: null }), video({ playing: false }), 2.5)).toEqual([])
  })
})

describe('nextPollDelay', () => {
  it('polls often while playing, and right as the song ends', () => {
    expect(nextPollDelay(spotify({ positionSeconds: 10 }), true)).toBe(4_000)
    expect(nextPollDelay(spotify({ positionSeconds: 198 }), true)).toBe(2_400)
    expect(nextPollDelay(spotify({ positionSeconds: 199.9 }), true)).toBe(1_000)
  })

  it('backs off when paused, idle or hidden', () => {
    expect(nextPollDelay(spotify({ playing: false }), true)).toBe(5_000)
    expect(nextPollDelay(spotify({ trackId: null }), true)).toBe(8_000)
    expect(nextPollDelay(spotify(), false)).toBe(15_000)
  })
})
