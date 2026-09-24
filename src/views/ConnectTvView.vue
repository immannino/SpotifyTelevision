<script setup lang="ts">
// Opened from the QR code on a TV's "Follow your Spotify" screen. Makes a Spotify login just
// for the TV (separate from this phone's own session) and hands it over through the room.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import logoUrl from '@/assets/spotify-mtv-logo.svg'
import type { IncomingForRemote, RemoteMessage } from '@/lib/cast/protocol'
import { normalizeCode, openRoomSocket, type RoomSocket } from '@/lib/cast/socket'
import { TV_GRANT_KEY, TV_SCOPES } from '@/lib/cast/tv-grant'
import { beginLogin, type Tokens } from '@/lib/spotify/auth'

/** How long to wait for the TV to be online and confirm. */
const HANDOFF_TIMEOUT_MS = 15_000

type Step = 'intro' | 'redirecting' | 'sending' | 'done' | 'error'

const route = useRoute()
const code = normalizeCode(typeof route.query.code === 'string' ? route.query.code : '')
const step = ref<Step>(code ? 'intro' : 'error')
const error = ref(code ? '' : 'This link is missing the TV code. Scan the QR code on your TV again.')

let grant: Tokens | null = null
let socket: RoomSocket<RemoteMessage> | null = null
let timeout: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  const saved = sessionStorage.getItem(TV_GRANT_KEY)
  // Don't leave the TV's login lying around in this browser.
  sessionStorage.removeItem(TV_GRANT_KEY)
  if (code && saved) {
    grant = JSON.parse(saved) as Tokens
    handOff()
  }
})

async function connect() {
  if (!code) return
  step.value = 'redirecting'
  await beginLogin({ scopes: TV_SCOPES, purpose: { type: 'tv', room: code } })
}

function handOff() {
  if (!code || !grant) return
  step.value = 'sending'
  cleanup()
  let sent = false
  timeout = setTimeout(
    () => fail('Your TV didn’t respond. Make sure the TV page is open, then try again.'),
    HANDOFF_TIMEOUT_MS,
  )
  socket = openRoomSocket<IncomingForRemote, RemoteMessage>(code, 'remote', {
    onMessage(message) {
      if (message.type === 'presence' && message.tv && !sent) {
        sent = true
        socket?.send({ type: 'spotify-auth', tokens: grant! })
      } else if (message.type === 'spotify-auth-ack') {
        cleanup()
        grant = null
        step.value = 'done'
      }
    },
    onFatal: () => fail('That TV code isn’t active anymore. Scan the QR code on your TV again.'),
  })
}

function fail(message: string) {
  cleanup()
  error.value = message
  step.value = 'error'
}

function retry() {
  if (grant) handOff()
  else step.value = code ? 'intro' : 'error'
}

function cleanup() {
  clearTimeout(timeout)
  socket?.close()
  socket = null
}

onBeforeUnmount(cleanup)
</script>

<template>
  <main class="connect">
    <section class="card">
      <img :src="logoUrl" alt="" class="logo" width="72" height="72" />

      <template v-if="step === 'intro' || step === 'redirecting'">
        <h1>Let your TV follow your Spotify</h1>
        <p class="lede">
          Log in to Spotify to connect TV <strong class="code">{{ code }}</strong>. It will only be able to see what's
          playing, and will show the video for whatever you play in any Spotify app.
        </p>
        <button class="btn-primary" :disabled="step === 'redirecting'" @click="connect">
          {{ step === 'redirecting' ? 'Opening Spotify…' : 'Continue with Spotify' }}
        </button>
        <p class="fine">You can sign the TV out any time from its screen.</p>
      </template>

      <template v-else-if="step === 'sending'">
        <div class="spinner" aria-hidden="true" />
        <h1>Connecting your TV…</h1>
        <p class="lede">Keep the TV page open.</p>
      </template>

      <template v-else-if="step === 'done'">
        <h1>Your TV is following your Spotify</h1>
        <p class="lede">Play music in any Spotify app. The TV shows the video for each song, in sync.</p>
        <RouterLink to="/" class="fine">Open Spotify Television on this phone</RouterLink>
      </template>

      <template v-else>
        <h1>Couldn't connect the TV</h1>
        <p class="error" role="alert">{{ error }}</p>
        <button v-if="code" class="btn-primary" @click="retry">Try again</button>
      </template>
    </section>
  </main>
</template>

<style scoped>
.connect {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
}
.card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 32px 28px;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
h1 {
  margin: 0;
  font-size: 1.4rem;
  letter-spacing: -0.01em;
}
.lede {
  margin: 0;
  color: var(--text-muted);
}
.code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  letter-spacing: 0.1em;
  color: var(--text);
}
.btn-primary {
  width: 100%;
}
.fine {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.error {
  margin: 0;
  color: #ffb3b3;
}
.spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid rgb(255 255 255 / 0.12);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
