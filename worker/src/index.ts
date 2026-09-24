// Maps a Spotify track ID to YouTube music video candidates.
//
// The YouTube API keys stay here instead of in the browser bundle, and every result is
// cached in KV for all users, so each song costs YouTube search quota (100 units, of a
// default 10,000/day per key) at most once. Searches rotate across the keys (keys.ts). Cache misses require a valid Spotify access token,
// which the Worker uses to fetch the track itself, so callers can't spend quota on
// arbitrary queries.
import { KeyPool, parseKeys, secondsUntilQuotaReset } from './keys'
import { buildQuery, decodeEntities, rankCandidates, type Candidate, type TrackInfo } from './search'

export interface Env {
  VIDEO_CACHE: KVNamespace
  /** One or more YouTube Data API keys, separated by commas or newlines. */
  YOUTUBE_API_KEYS?: string
  /** Single-key form, still accepted. */
  YOUTUBE_API_KEY?: string
  /** Comma-separated list of origins allowed to call the Worker. */
  ALLOWED_ORIGINS: string
}

const TRACK_ID = /^[A-Za-z0-9]{22}$/
const CACHE_VERSION = 'v1'
/** Retry "no results" after a week in case a video gets uploaded. */
const NOT_FOUND_TTL_S = 7 * 24 * 60 * 60

type CacheEntry = { candidates: Candidate[] }

export default {
  async fetch(request, env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    const cors: Record<string, string> =
      origin && allowedOrigins.includes(origin)
        ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
        : {}

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const url = new URL(request.url)
    if (request.method !== 'GET' || url.pathname !== '/v1/video') return json({ error: 'not_found' }, 404, cors)

    const trackId = url.searchParams.get('trackId') ?? ''
    if (!TRACK_ID.test(trackId)) return json({ error: 'invalid_track_id' }, 400, cors)

    const cacheKey = `video:${CACHE_VERSION}:${trackId}`
    const cached = await env.VIDEO_CACHE.get<CacheEntry>(cacheKey, 'json')
    if (cached) return respond(trackId, cached.candidates, cors)

    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return json({ error: 'unauthorized' }, 401, cors)

    const track = await fetchSpotifyTrack(trackId, token)
    if (track === 'unauthorized') return json({ error: 'unauthorized' }, 401, cors)
    if (!track) return json({ error: 'track_not_found' }, 404, cors)

    const pool = new KeyPool(parseKeys(env.YOUTUBE_API_KEYS, env.YOUTUBE_API_KEY), env.VIDEO_CACHE)
    if (!pool.size) {
      console.error('No YouTube API keys configured (YOUTUBE_API_KEYS)')
      return json({ error: 'misconfigured' }, 500, cors)
    }

    const result = await searchWithPool(track, pool)
    if (result === 'quota') {
      return json({ error: 'quota_exceeded' }, 503, { ...cors, 'Retry-After': String(secondsUntilQuotaReset(Date.now())) })
    }
    if (result === 'error') return json({ error: 'upstream_error' }, 502, cors)

    const candidates = rankCandidates(result, track)
    await env.VIDEO_CACHE.put(
      cacheKey,
      JSON.stringify({ candidates } satisfies CacheEntry),
      candidates.length ? {} : { expirationTtl: NOT_FOUND_TTL_S },
    )
    return respond(trackId, candidates, cors)
  },
} satisfies ExportedHandler<Env>

function respond(trackId: string, candidates: Candidate[], cors: Record<string, string>): Response {
  if (!candidates.length) return json({ error: 'no_video' }, 404, cors)
  return json({ trackId, candidates }, 200, { ...cors, 'Cache-Control': 'public, max-age=86400' })
}

async function fetchSpotifyTrack(trackId: string, token: string): Promise<TrackInfo | 'unauthorized' | null> {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) return 'unauthorized'
  if (!res.ok) return null
  const track = (await res.json()) as { name: string; artists: { name: string }[] }
  const artist = track.artists[0]?.name
  return artist ? { name: track.name, artist } : null
}

/** Tries each available key in rotation, moving on when one is out of quota or rejected. */
async function searchWithPool(track: TrackInfo, pool: KeyPool): Promise<Candidate[] | 'quota' | 'error'> {
  let sawError = false
  for await (const key of pool.available()) {
    const result = await searchYouTube(track, key)
    if (result === 'quota') {
      await pool.markExhausted(key)
    } else if (result === 'bad-key') {
      console.error(`YouTube key ${await KeyPool.describe(key)} was rejected (invalid, API disabled, or referrer-restricted)`)
    } else if (result === 'error') {
      sawError = true
    } else {
      return result
    }
  }
  return sawError ? 'error' : 'quota'
}

// Reasons that mean this key will never work, as opposed to a transient failure.
const BAD_KEY_REASONS = new Set(['keyInvalid', 'API_KEY_INVALID', 'ipRefererBlocked', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED', 'accessNotConfigured', 'SERVICE_DISABLED', 'forbidden'])
// Daily quota only; per-second throttling (rateLimitExceeded) falls through to 'error' and tries the next key.
const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded'])

async function searchYouTube(track: TrackInfo, apiKey: string): Promise<Candidate[] | 'quota' | 'bad-key' | 'error'> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    // A search costs the same quota regardless of maxResults, so fetch extras to fall
    // back on when a video turns out not to play in the embed.
    maxResults: '5',
    q: buildQuery(track),
    key: apiKey,
  }).toString()

  const res = await fetch(url)
  if (!res.ok) {
    // Google reports the reason in the legacy `errors` array, the newer `details`, or both.
    const body = (await res.json().catch(() => null)) as {
      error?: { errors?: { reason?: string }[]; details?: { reason?: string }[] }
    } | null
    const reasons = [...(body?.error?.errors ?? []), ...(body?.error?.details ?? [])].map((e) => e.reason ?? '')
    if (reasons.some((r) => QUOTA_REASONS.has(r))) return 'quota'
    if (reasons.some((r) => BAD_KEY_REASONS.has(r))) return 'bad-key'
    return 'error'
  }

  const body = (await res.json()) as { items: { id: { videoId?: string }; snippet: { title: string } }[] }
  return body.items.flatMap((item) =>
    item.id.videoId ? [{ id: item.id.videoId, title: decodeEntities(item.snippet.title) }] : [],
  )
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
