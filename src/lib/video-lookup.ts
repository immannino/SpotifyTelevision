// Client for the lookup Worker (see worker/), which maps a Spotify track ID to YouTube
// video candidates. Results are cached in IndexedDB so repeat plays skip the network.
import { createStore, get, set } from 'idb-keyval'
import { config } from '@/config'

export interface VideoCandidate {
  id: string
  title: string
}

export class LookupError extends Error {
  constructor(
    readonly kind: 'not-found' | 'quota' | 'unauthorized' | 'network',
    message: string,
  ) {
    super(message)
  }
}

const cache = createStore('spotify-television', 'videos')
const inflight = new Map<string, Promise<VideoCandidate[]>>()

export function lookupVideos(trackId: string, accessToken: string): Promise<VideoCandidate[]> {
  let pending = inflight.get(trackId)
  if (!pending) {
    pending = fetchCandidates(trackId, accessToken).finally(() => inflight.delete(trackId))
    inflight.set(trackId, pending)
  }
  return pending
}

async function fetchCandidates(trackId: string, accessToken: string): Promise<VideoCandidate[]> {
  const cached = await get<VideoCandidate[]>(trackId, cache).catch(() => undefined)
  if (cached?.length) return cached

  let res: Response
  try {
    res = await fetch(`${config.videoLookupUrl}/v1/video?trackId=${encodeURIComponent(trackId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new LookupError('network', "Couldn't reach the video lookup service.")
  }

  if (res.status === 404) throw new LookupError('not-found', 'No music video found for this song.')
  if (res.status === 401) throw new LookupError('unauthorized', 'Spotify session expired.')
  if (res.status === 503) throw new LookupError('quota', 'Video search is out of quota for today. Cached songs still play.')
  if (!res.ok) throw new LookupError('network', `Video lookup failed (${res.status}).`)

  const { candidates } = (await res.json()) as { candidates: VideoCandidate[] }
  await set(trackId, candidates, cache).catch(() => {})
  return candidates
}
