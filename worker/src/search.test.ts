import { describe, expect, it } from 'vitest'
import { buildQuery, cleanTrackName, decodeEntities, rankCandidates } from './search'

describe('cleanTrackName', () => {
  it.each([
    ['Here Comes The Sun - Remastered 2009', 'Here Comes The Sun'],
    ['Heroes - 2017 Remaster', 'Heroes'],
    ['Stay (feat. Mikky Ekko)', 'Stay'],
    ['Old Town Road [with Billy Ray Cyrus]', 'Old Town Road'],
    ['Mr. Brightside', 'Mr. Brightside'],
    ['Song 2 - Radio Edit', 'Song 2 - Radio Edit'],
  ])('%s → %s', (input, expected) => {
    expect(cleanTrackName(input)).toBe(expected)
  })
})

describe('buildQuery', () => {
  it('combines artist, cleaned name and "official video"', () => {
    expect(buildQuery({ artist: 'The Beatles', name: 'Help! - Remastered 2015' })).toBe('The Beatles Help! official video')
  })
})

describe('rankCandidates', () => {
  const track = { artist: 'Daft Punk', name: 'One More Time' }

  it('prefers the official video over live and lyric uploads', () => {
    const ranked = rankCandidates(
      [
        { id: 'a', title: 'One More Time (Live at Coachella)' },
        { id: 'b', title: 'Daft Punk - One More Time (Lyrics)' },
        { id: 'c', title: 'Daft Punk - One More Time (Official Video)' },
      ],
      track,
    )
    expect(ranked[0]!.id).toBe('c')
  })

  it('keeps live versions when the Spotify track is live', () => {
    const ranked = rankCandidates(
      [
        { id: 'studio', title: 'Nirvana - About A Girl' },
        { id: 'live', title: 'Nirvana - About A Girl (MTV Unplugged Live)' },
      ],
      { artist: 'Nirvana', name: 'About A Girl - Live' },
    )
    expect(ranked.map((c) => c.id)).toEqual(['studio', 'live'])
  })

  it('keeps YouTube order for ties', () => {
    const ranked = rankCandidates(
      [
        { id: '1', title: 'Daft Punk - One More Time' },
        { id: '2', title: 'Daft Punk - One More Time' },
      ],
      track,
    )
    expect(ranked.map((c) => c.id)).toEqual(['1', '2'])
  })
})

describe('decodeEntities', () => {
  it('decodes the entities YouTube emits', () => {
    expect(decodeEntities('Guns N&#39; Roses - Sweet Child O&#39; Mine &amp; more')).toBe("Guns N' Roses - Sweet Child O' Mine & more")
  })
})
