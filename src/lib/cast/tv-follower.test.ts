import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VideoPlayer } from '@/lib/player/types'
import { SpotifyApiError } from '@/lib/spotify/api'
import type { PlaybackState, SpotifyTrack } from '@/lib/spotify/types'
import { TvFollower } from './tv-follower'

const track = (id: string, name = id): SpotifyTrack => ({
  type: 'track',
  id,
  name,
  duration_ms: 240_000,
  is_local: false,
  artists: [{ id: 'a', name: 'Artist' }],
  album: { name: 'Album', images: [] },
})

const state = (t: SpotifyTrack, progressMs: number, playing = true): PlaybackState => ({
  device: { id: 'd', name: 'Living Room', type: 'Speaker', is_active: true },
  is_playing: playing,
  progress_ms: progressMs,
  currently_playing_type: 'track',
  item: t,
})

function setup() {
  let current: PlaybackState | null | Error = null
  const calls: string[] = []
  const video = { time: 0, muted: false }
  const player: VideoPlayer = {
    load: (id, start) => {
      calls.push(`load:${id}@${Math.round(start ?? 0)}`)
      video.time = start ?? 0
    },
    play: () => calls.push('play'),
    pause: () => calls.push('pause'),
    seekTo: (s) => {
      calls.push(`seek:${Math.round(s)}`)
      video.time = s
    },
    currentTime: () => video.time,
    duration: () => 300,
    setMuted: (m) => (video.muted = m),
    destroy: () => {},
  }
  const lookup = vi.fn(async (id: string) => {
    if (id === 'novideo') throw new Error('not found')
    return [{ id: `${id}-v1`, title: '' }, { id: `${id}-v2`, title: '' }]
  })
  const follower = new TvFollower({
    playbackState: async () => {
      if (current instanceof Error) throw current
      return current
    },
    lookup,
    player,
    onChange: () => {},
  })
  return {
    follower,
    calls,
    video,
    lookup,
    spotify: (s: PlaybackState | null | Error) => (current = s),
    // Runs the pending poll and lets its lookup resolve.
    tick: async (ms = 0) => {
      await vi.advanceTimersByTimeAsync(ms)
    },
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('TvFollower', () => {
  it('mutes, then plays the video for the current song at Spotify’s position', async () => {
    const t = setup()
    t.spotify(state(track('song1', 'One'), 42_000))
    t.follower.start()
    await t.tick()
    expect(t.video.muted).toBe(true)
    expect(t.calls).toEqual(['load:song1-v1@42'])
    expect(t.follower.track?.name).toBe('One')
    expect(t.follower.device).toBe('Living Room')
    expect(t.follower.status).toBe('playing')
  })

  it('keeps polling and seeks when Spotify jumps', async () => {
    const t = setup()
    t.spotify(state(track('song1'), 42_000))
    t.follower.start()
    await t.tick()
    t.follower.onPlayerState('playing')
    t.spotify(state(track('song1'), 150_000))
    await t.tick(4_000)
    expect(t.calls.at(-1)).toBe('seek:150')
  })

  it('switches videos when the song changes', async () => {
    const t = setup()
    t.spotify(state(track('song1'), 1_000))
    t.follower.start()
    await t.tick()
    t.spotify(state(track('song2'), 2_000))
    await t.tick(4_000)
    expect(t.calls.at(-1)).toBe('load:song2-v1@2')
  })

  it('tries the next candidate at the current position when a video won’t embed', async () => {
    const t = setup()
    t.spotify(state(track('song1'), 10_000))
    t.follower.start()
    await t.tick()
    await vi.advanceTimersByTimeAsync(2_000)
    t.follower.onPlayerError('unavailable')
    expect(t.calls.at(-1)).toMatch(/^load:song1-v2@1[12]$/)
  })

  it('reports songs without a video and does not retry them every poll', async () => {
    const t = setup()
    t.spotify(state(track('novideo'), 0))
    t.follower.start()
    await t.tick()
    await t.tick(4_000)
    expect(t.follower.status).toBe('no-video')
    expect(t.lookup).toHaveBeenCalledTimes(1)
  })

  it('stops and reports signed-out when Spotify rejects the login', async () => {
    const t = setup()
    t.spotify(new SpotifyApiError(401, 'expired'))
    t.follower.start()
    await t.tick()
    expect(t.follower.status).toBe('signed-out')
    expect(t.follower.isRunning).toBe(false)
  })

  it('pauses when Spotify stops, and clears the song after a second empty poll', async () => {
    const t = setup()
    t.spotify(state(track('song1'), 1_000))
    t.follower.start()
    await t.tick()
    t.follower.onPlayerState('playing')
    t.spotify(null)
    await t.tick(4_000)
    expect(t.calls.at(-1)).toBe('pause')
    expect(t.follower.track).not.toBeNull()
    await t.tick(5_000)
    expect(t.follower.track).toBeNull()
    expect(t.follower.status).toBe('waiting')
  })

  it('waits when nothing is playing', async () => {
    const t = setup()
    t.spotify(null)
    t.follower.start()
    await t.tick()
    expect(t.follower.status).toBe('waiting')
    expect(t.calls).toEqual([])
  })
})
