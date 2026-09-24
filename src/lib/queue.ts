// Pure playback-order logic, kept free of Vue so it can be unit tested and later shared
// with a TV receiver. An "order" is a permutation of track indices; a "position" points into it.

export type RepeatMode = 'off' | 'all' | 'one'

type Rng = () => number

/** Identity order, or a shuffle that keeps `startIndex` first so the chosen song plays now. */
export function buildOrder(length: number, shuffle: boolean, startIndex = 0, rng: Rng = Math.random): number[] {
  const indices = Array.from({ length }, (_, i) => i)
  if (!shuffle) return indices
  const rest = indices.filter((i) => i !== startIndex)
  fisherYates(rest, rng)
  return startIndex >= 0 && startIndex < length ? [startIndex, ...rest] : rest
}

/**
 * Appends indices for tracks that arrived after the order was built (playlists keep
 * paginating while you listen). New tracks go at the end, shuffled among themselves.
 */
export function extendOrder(order: number[], length: number, shuffle: boolean, rng: Rng = Math.random): number[] {
  if (order.length >= length) return order
  const added = Array.from({ length: length - order.length }, (_, i) => order.length + i)
  if (shuffle) fisherYates(added, rng)
  return [...order, ...added]
}

/**
 * Moves one step in `direction`, skipping unplayable tracks. Returns the new position, or
 * null when playback should stop (the end of the list with repeat off, or nothing playable).
 * Repeat-one is treated like repeat-all here; replaying the same song on end is the caller's job.
 */
export function advance(opts: {
  order: number[]
  position: number
  direction: 1 | -1
  repeat: RepeatMode
  isPlayable: (trackIndex: number) => boolean
}): number | null {
  const { order, direction, repeat, isPlayable } = opts
  const n = order.length
  let pos = opts.position

  for (let steps = 0; steps < n; steps++) {
    pos += direction
    if (pos < 0 || pos >= n) {
      if (repeat === 'off') return null
      pos = (pos + n) % n
    }
    if (isPlayable(order[pos]!)) return pos
  }
  return null
}

export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  return mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'
}

function fisherYates(arr: number[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}
