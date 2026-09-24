import type { PlaybackState, VideoPlayer, VideoPlayerEvents } from './types'

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiReady: Promise<typeof YT> | null = null

/** Loads the YouTube IFrame API script once. */
function loadIframeApi(): Promise<typeof YT> {
  apiReady ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT)
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      apiReady = null
      reject(new Error('Failed to load the YouTube player'))
    }
    document.head.append(script)
  })
  return apiReady
}

const STATES: Record<number, PlaybackState> = {
  [-1]: 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
}

/** Plays videos in an embedded YouTube iframe on this page. */
export async function createLocalYouTubePlayer(el: HTMLElement, events: VideoPlayerEvents): Promise<VideoPlayer> {
  const api = await loadIframeApi()

  const player = await new Promise<YT.Player>((resolve) => {
    const p: YT.Player = new api.Player(el, {
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: () => resolve(p),
        onStateChange: (e) => {
          const state = STATES[e.data]
          if (state) events.onStateChange(state)
        },
        // 100: not found/removed, 101 & 150: owner disallows embedding.
        onError: (e) => events.onError([100, 101, 150].includes(e.data) ? 'unavailable' : 'unknown'),
      },
    })
  })

  return {
    load: (videoId) => player.loadVideoById(videoId),
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    seekTo: (seconds) => player.seekTo(seconds, true),
    currentTime: () => player.getCurrentTime() ?? 0,
    destroy: () => player.destroy(),
  }
}
