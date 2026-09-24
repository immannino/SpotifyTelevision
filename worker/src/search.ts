// Pure helpers for turning a Spotify track into a YouTube search and ranking the results.

export interface TrackInfo {
  name: string
  artist: string
}

export interface Candidate {
  id: string
  title: string
}

/** Strips Spotify-style suffixes that rarely appear in video titles ("- Remastered 2011"). */
export function cleanTrackName(name: string): string {
  return name
    .replace(/\s+-\s+.*\b(remaster(ed)?|mono|stereo|single version|album version|\d{4} mix)\b.*$/i, '')
    .replace(/\s*[([]\s*(feat\.?|ft\.?|with)\s[^)\]]*[)\]]/gi, '')
    .trim()
}

export function buildQuery(track: TrackInfo): string {
  return `${track.artist} ${cleanTrackName(track.name)} official video`
}

const UNWANTED = /\b(live|cover|karaoke|reaction|lyrics?|slowed|reverb|8d|instrumental|remix|sped up)\b/i

/**
 * Re-ranks YouTube's relevance order: prefer titles naming the song and artist and marked
 * official, and push down live/cover/lyric uploads unless the Spotify title asks for one.
 * The sort is stable, so ties keep YouTube's order.
 */
export function rankCandidates(candidates: Candidate[], track: TrackInfo): Candidate[] {
  const name = normalize(cleanTrackName(track.name))
  const artist = normalize(track.artist)
  const wantsUnwanted = UNWANTED.test(track.name)

  const score = (c: Candidate) => {
    const title = normalize(c.title)
    let s = 0
    if (title.includes(name)) s += 3
    if (title.includes(artist)) s += 2
    if (/\bofficial\b/.test(title)) s += 1
    if (!wantsUnwanted && UNWANTED.test(c.title)) s -= 3
    return s
  }

  return candidates
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s)
    .map(({ c }) => c)
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

/** The YouTube Data API returns HTML-escaped titles. */
export function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
