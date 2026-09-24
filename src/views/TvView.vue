<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { renderSVG } from 'uqr'
import logoUrl from '@/assets/spotify-mtv-logo.svg'
import type { IncomingForTv, TvMessage } from '@/lib/cast/protocol'
import { TvReceiver } from '@/lib/cast/receiver'
import { createRoom, openRoomSocket, type RoomSocket } from '@/lib/cast/socket'
import type { VideoPlayer } from '@/lib/player/types'
import { createLocalYouTubePlayer } from '@/lib/player/youtube-iframe'

const CODE_KEY = 'stv:tv-code'
/** How long the song credits stay up after a new song starts. */
const CREDITS_MS = 9000

type Phase = 'start' | 'pairing' | 'ready' | 'replaced' | 'error'

const phase = ref<Phase>('start')
const code = ref<string | null>(null)
const remotes = ref(0)
const online = ref(false)
const errorMessage = ref('')
const mount = useTemplateRef<HTMLElement>('mount')

// The receiver is a plain class; bump a counter on each change so the template re-renders.
const version = ref(0)
let socket: RoomSocket<TvMessage> | null = null
const receiver = new TvReceiver(
  (message) => socket?.send(message),
  () => version.value++,
)
const current = computed(() => (version.value, receiver.current))
const state = computed(() => (version.value, receiver.state))
const video = shallowRef<VideoPlayer | null>(null)

const joinUrl = computed(() =>
  code.value ? new URL(`${import.meta.env.BASE_URL}?cast=${code.value}`, window.location.origin).toString() : '',
)
const siteLabel = computed(() => {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin)
  return `${url.host}${url.pathname}`.replace(/\/$/, '')
})
const qrSvg = computed(() => (joinUrl.value ? renderSVG(joinUrl.value, { border: 1 }) : ''))

// --- Song credits, MTV style ---------------------------------------------------------------
const showCredits = ref(false)
let creditsTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => current.value?.key,
  (key) => {
    clearTimeout(creditsTimer)
    showCredits.value = !!key
    if (key) creditsTimer = setTimeout(() => (showCredits.value = false), CREDITS_MS)
  },
)
const creditsVisible = computed(() => showCredits.value || state.value === 'paused')

// --- Startup -------------------------------------------------------------------------------

/** Runs from the Start button, so the page has the user gesture that lets videos play with sound. */
async function start() {
  phase.value = 'pairing'
  void document.documentElement.requestFullscreen?.().catch(() => {})
  void keepAwake()
  try {
    const player = await createLocalYouTubePlayer(mount.value!, {
      onStateChange: (s) => receiver.onPlayerState(s),
      onError: (kind) => receiver.onPlayerError(kind),
    })
    video.value = player
    receiver.attach(player)
    await joinRoom(localStorage.getItem(CODE_KEY))
  } catch (err) {
    phase.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong.'
  }
}

async function joinRoom(reclaim: string | null) {
  socket?.close()
  const newCode = await createRoom(reclaim)
  code.value = newCode
  localStorage.setItem(CODE_KEY, newCode)
  phase.value = 'ready'

  socket = openRoomSocket<IncomingForTv, TvMessage>(newCode, 'tv', {
    onStatus: (status) => (online.value = status === 'open'),
    onOpen: () => receiver.report(),
    onMessage(message) {
      if (message.type === 'presence') remotes.value = message.remotes
      else receiver.handle(message)
    },
    onFatal(reason) {
      if (reason === 'replaced') {
        phase.value = 'replaced'
      } else {
        // The room expired while we were away; get a fresh code.
        void joinRoom(null)
      }
    },
  })
}

function startOver() {
  localStorage.removeItem(CODE_KEY)
  phase.value = 'pairing'
  void joinRoom(null)
}

// --- TV niceties ---------------------------------------------------------------------------

let wakeLock: WakeLockSentinel | null = null
async function keepAwake() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null
  } catch {
    // Not supported or denied; the TV may dim.
  }
}
function onVisibility() {
  if (document.visibilityState === 'visible' && phase.value !== 'start') void keepAwake()
}
document.addEventListener('visibilitychange', onVisibility)

/** The TV remote's OK / play-pause buttons. */
function onKeydown(e: KeyboardEvent) {
  if (phase.value === 'start' || !current.value) return
  if ([' ', 'Enter', 'MediaPlayPause', 'k'].includes(e.key)) {
    e.preventDefault()
    receiver.togglePlay()
  }
}
window.addEventListener('keydown', onKeydown)

const cursorHidden = ref(false)
let cursorTimer: ReturnType<typeof setTimeout> | undefined
function onPointerMove() {
  cursorHidden.value = false
  clearTimeout(cursorTimer)
  cursorTimer = setTimeout(() => (cursorHidden.value = true), 3000)
}

onBeforeUnmount(() => {
  socket?.close()
  video.value?.destroy()
  void wakeLock?.release()
  clearTimeout(creditsTimer)
  clearTimeout(cursorTimer)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <main class="tv" :class="{ 'hide-cursor': cursorHidden }" @pointermove="onPointerMove">
    <div class="glow" aria-hidden="true" />

    <!-- Always mounted so the player can be created from the Start click. -->
    <div class="video" :class="{ live: current }">
      <div ref="mount" />
    </div>

    <section v-if="phase === 'start'" class="center">
      <img :src="logoUrl" alt="" class="logo" />
      <h1>Spotify Television</h1>
      <p class="lede">Turn this screen into a music video channel for your Spotify playlists.</p>
      <button class="btn-primary big" autofocus @click="start">Start TV mode</button>
      <p class="fine">Press OK on your remote, or click.</p>
    </section>

    <section v-else-if="phase === 'pairing'" class="center">
      <div class="spinner" aria-hidden="true" />
      <p class="lede">Getting a code…</p>
    </section>

    <section v-else-if="phase === 'replaced'" class="center">
      <h1>This code moved to another screen</h1>
      <p class="lede">Another TV opened the same code, so this one stepped aside.</p>
      <button class="btn-primary big" autofocus @click="startOver">Get a new code</button>
    </section>

    <section v-else-if="phase === 'error'" class="center">
      <h1>Couldn't start TV mode</h1>
      <p class="lede">{{ errorMessage }}</p>
      <button class="btn-primary big" autofocus @click="startOver">Try again</button>
    </section>

    <section v-else-if="!current" class="pairing">
      <div class="pair-text">
        <img :src="logoUrl" alt="" class="logo small" />
        <h1 v-if="remotes > 0">Connected. Pick a song on your phone.</h1>
        <h1 v-else>Pair your phone</h1>
        <ol v-if="remotes === 0" class="steps">
          <li>Scan the QR code, <em>or</em></li>
          <li>Open <strong>{{ siteLabel }}</strong> on your phone</li>
          <li>Tap the cast button and enter this code</li>
        </ol>
        <p v-else class="lede">{{ remotes }} {{ remotes === 1 ? 'phone' : 'phones' }} connected</p>
        <p class="code" :aria-label="`Code ${code?.split('').join(' ')}`">{{ code }}</p>
      </div>
      <!-- v-html is safe here: the SVG is generated locally from our own URL. -->
      <div v-if="remotes === 0" class="qr" v-html="qrSvg" />
    </section>

    <section v-if="state === 'failing'" class="center failing">
      <h1>Videos aren't playing on this screen</h1>
      <p class="lede">Several in a row failed to load. Pick another song on your phone, or reload this page.</p>
    </section>

    <!-- Song credits over the video. -->
    <Transition name="credits">
      <div v-if="current && creditsVisible && state !== 'failing'" class="credits">
        <p class="artist">{{ current.track.artists.join(', ') }}</p>
        <p class="title">“{{ current.track.name }}”</p>
        <p class="album">{{ current.track.album }}</p>
      </div>
    </Transition>

    <div v-if="phase === 'ready'" class="badge" :class="{ offline: !online, faded: current && !creditsVisible }">
      <span class="dot" aria-hidden="true" />
      {{ online ? code : 'Reconnecting…' }}
    </div>
  </main>
</template>

<style scoped>
.tv {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #000;
  color: var(--text);
  font-size: clamp(14px, 1.4vw, 28px);
}
.hide-cursor {
  cursor: none;
}
.glow {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(35% 35% at 25% 30%, rgb(119 201 212 / 0.28), transparent 70%),
    radial-gradient(35% 35% at 75% 70%, rgb(87 220 144 / 0.24), transparent 70%);
  filter: blur(60px);
}
.video {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.6s;
  pointer-events: none;
}
.video.live {
  opacity: 1;
}
.video :deep(iframe) {
  width: 100%;
  height: 100%;
  border: 0;
}

.center {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8em;
  padding: 5vh 5vw;
  text-align: center;
}
h1 {
  margin: 0;
  font-size: 2.4em;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
.lede {
  margin: 0;
  color: var(--text-muted);
  font-size: 1.15em;
}
.fine {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85em;
}
.logo {
  width: 7em;
  filter: drop-shadow(0 0.4em 1.2em rgb(87 220 144 / 0.35));
}
.logo.small {
  width: 4.5em;
}
.btn-primary.big {
  margin-top: 1em;
  padding: 0.8em 2.2em;
  font-size: 1.2em;
}
.btn-primary.big:focus-visible {
  outline: 0.2em solid #fff;
  outline-offset: 0.25em;
}

.pairing {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6vw;
  padding: 6vh 7vw;
}
.pair-text {
  display: flex;
  flex-direction: column;
  gap: 0.9em;
  max-width: 32em;
}
.steps {
  margin: 0;
  padding-left: 1.3em;
  color: var(--text-muted);
  font-size: 1.15em;
  line-height: 1.8;
}
.steps strong {
  color: var(--text);
}
.code {
  margin: 0.3em 0 0;
  font: 800 4.5em/1 ui-monospace, 'SF Mono', Menlo, monospace;
  letter-spacing: 0.18em;
  background: var(--gradient);
  background-clip: text;
  color: transparent;
}
.qr {
  flex: none;
  width: min(34vh, 28vw);
  padding: 1em;
  background: #fff;
  border-radius: 1em;
  box-shadow: 0 2em 5em rgb(0 0 0 / 0.5);
}
.qr :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}

/* Lower-third credits, in the spirit of MTV's classic video credits. */
.credits {
  position: absolute;
  left: 5vw;
  bottom: 8vh;
  max-width: 60vw;
  padding: 0.6em 1em 0.7em 1.1em;
  border-left: 0.25em solid var(--accent);
  background: linear-gradient(90deg, rgb(0 0 0 / 0.65), rgb(0 0 0 / 0));
  text-shadow: 0 0.1em 0.4em rgb(0 0 0 / 0.8);
}
.credits p {
  margin: 0;
  line-height: 1.25;
}
.artist {
  font-weight: 700;
  font-size: 1.3em;
}
.title {
  font-size: 1.3em;
}
.album {
  color: rgb(255 255 255 / 0.75);
  font-size: 0.95em;
}
.credits-enter-active,
.credits-leave-active {
  transition:
    opacity 0.6s,
    transform 0.6s;
}
.credits-enter-from,
.credits-leave-to {
  opacity: 0;
  transform: translateX(-1em);
}

.badge {
  position: absolute;
  top: 4vh;
  right: 4vw;
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.35em 0.8em;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.55);
  font: 600 0.9em ui-monospace, 'SF Mono', Menlo, monospace;
  letter-spacing: 0.12em;
  transition: opacity 0.6s;
}
.badge.faded {
  opacity: 0;
}
.badge .dot {
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  background: var(--accent);
}
.badge.offline .dot {
  background: #f5c542;
}
.failing {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.85);
}
.spinner {
  width: 3em;
  height: 3em;
  border-radius: 50%;
  border: 0.25em solid rgb(255 255 255 / 0.12);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
