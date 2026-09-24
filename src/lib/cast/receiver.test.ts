import { describe, expect, it } from 'vitest'
import type { VideoPlayer } from '@/lib/player/types'
import type { CastItem, QueueMessage, StatusMessage } from './protocol'
import { MAX_CONSECUTIVE_FAILURES, TvReceiver } from './receiver'

function fakePlayer() {
  const calls: string[] = []
  const player: VideoPlayer = {
    load: (id, start) => calls.push(`load:${id}${start ? `@${start}` : ''}`),
    play: () => calls.push('play'),
    pause: () => calls.push('pause'),
    seekTo: (s) => calls.push(`seek:${s}`),
    currentTime: () => 42,
    destroy: () => {},
  }
  return { player, calls }
}

const item = (key: string, ...videos: string[]): CastItem => ({
  key,
  track: { name: key, artists: ['A'], album: 'B', artworkUrl: null },
  candidates: videos.map((id) => ({ id, title: id })),
})

const queue = (seq: number, items: CastItem[], extra: Partial<QueueMessage> = {}): QueueMessage => ({
  type: 'queue',
  seq,
  items,
  loop: false,
  restart: false,
  ...extra,
})

function setup() {
  const sent: StatusMessage[] = []
  const receiver = new TvReceiver((m) => sent.push(m))
  const { player, calls } = fakePlayer()
  receiver.attach(player)
  return { receiver, calls, sent, lastStatus: () => sent.at(-1)! }
}

describe('TvReceiver', () => {
  it('loads the first item of a new queue', () => {
    const { receiver, calls, lastStatus } = setup()
    receiver.handle(queue(1, [item('a', 'va'), item('b', 'vb')], { startSeconds: 30 }))
    expect(calls).toEqual(['load:va@30'])
    expect(lastStatus()).toMatchObject({ seq: 1, index: 0, state: 'buffering' })
  })

  it('advances through the queue on its own when a video ends', () => {
    const { receiver, calls, lastStatus } = setup()
    receiver.handle(queue(1, [item('a', 'va'), item('b', 'vb')]))
    receiver.onPlayerState('ended')
    expect(calls.at(-1)).toBe('load:vb')
    expect(lastStatus()).toMatchObject({ seq: 1, index: 1 })
  })

  it('reports ended after the last item', () => {
    const { receiver, lastStatus } = setup()
    receiver.handle(queue(1, [item('a', 'va')]))
    receiver.onPlayerState('ended')
    expect(lastStatus()).toMatchObject({ index: 0, state: 'ended' })
  })

  it('does not restart the current video when the phone re-sends the queue', () => {
    const { receiver, calls, lastStatus } = setup()
    receiver.handle(queue(1, [item('a', 'va'), item('b', 'vb')]))
    receiver.onPlayerState('ended') // now on b
    receiver.handle(queue(2, [item('b', 'vb'), item('c', 'vc')]))
    expect(calls.filter((c) => c.startsWith('load'))).toEqual(['load:va', 'load:vb'])
    expect(lastStatus()).toMatchObject({ seq: 2, index: 0 })
  })

  it('restarts when asked, even for the same item', () => {
    const { receiver, calls } = setup()
    receiver.handle(queue(1, [item('a', 'va')]))
    receiver.handle(queue(2, [item('a', 'va')], { restart: true }))
    expect(calls).toEqual(['load:va', 'load:va'])
  })

  it('tries the next candidate when a video cannot be embedded, then skips the item', () => {
    const { receiver, calls } = setup()
    receiver.handle(queue(1, [item('a', 'v1', 'v2'), item('b', 'vb')]))
    receiver.onPlayerError('unavailable')
    expect(calls.at(-1)).toBe('load:v2')
    receiver.onPlayerError('unavailable')
    expect(calls.at(-1)).toBe('load:vb')
  })

  it('stops instead of racing through the queue when videos keep failing', () => {
    const { receiver, calls, lastStatus } = setup()
    const items = Array.from({ length: 10 }, (_, i) => item(`t${i}`, `v${i}`))
    receiver.handle(queue(1, items))
    for (let i = 0; i < 10; i++) receiver.onPlayerError('unknown')
    expect(calls.filter((c) => c.startsWith('load'))).toHaveLength(MAX_CONSECUTIVE_FAILURES)
    expect(lastStatus()).toMatchObject({ state: 'failing', index: MAX_CONSECUTIVE_FAILURES - 1 })
  })

  it('resets the failure count once something plays, and on a new queue', () => {
    const { receiver, lastStatus } = setup()
    receiver.handle(queue(1, Array.from({ length: 10 }, (_, i) => item(`t${i}`, `v${i}`))))
    receiver.onPlayerError('unknown')
    receiver.onPlayerError('unknown')
    receiver.onPlayerState('playing')
    receiver.onPlayerError('unknown')
    receiver.onPlayerError('unknown')
    expect(lastStatus().state).not.toBe('failing')
    receiver.onPlayerError('unknown')
    expect(lastStatus().state).toBe('failing')
    receiver.handle(queue(2, [item('x', 'vx')], { restart: true }))
    expect(lastStatus().state).toBe('buffering')
  })

  it('loops the current item for repeat-one', () => {
    const { receiver, calls } = setup()
    receiver.handle(queue(1, [item('a', 'va'), item('b', 'vb')], { loop: true }))
    receiver.onPlayerState('ended')
    expect(calls.slice(-2)).toEqual(['seek:0', 'play'])
  })

  it('applies play/pause/seek commands', () => {
    const { receiver, calls } = setup()
    receiver.handle(queue(1, [item('a', 'va')]))
    receiver.handle({ type: 'command', command: 'pause' })
    receiver.handle({ type: 'command', command: 'seek', seconds: 10 })
    expect(calls.slice(-2)).toEqual(['pause', 'seek:10'])
  })

  it('loads a queue that arrived before the player was ready', () => {
    const sent: StatusMessage[] = []
    const receiver = new TvReceiver((m) => sent.push(m))
    receiver.handle(queue(1, [item('a', 'va')], { startSeconds: 12 }))
    const { player, calls } = fakePlayer()
    receiver.attach(player)
    expect(calls).toEqual(['load:va@12'])
  })
})
