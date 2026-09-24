<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { beginLogin, completeLogin } from '@/lib/spotify/auth'
import { TV_GRANT_KEY } from '@/lib/cast/tv-grant'
import logoUrl from '@/assets/spotify-mtv-logo.svg'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const busy = ref(false)
const error = ref<string | null>(auth.sessionExpired ? 'Your Spotify session expired. Log in again to keep watching.' : null)

onMounted(async () => {
  const { code, state, error: oauthError } = route.query
  if (typeof oauthError === 'string') {
    error.value = oauthError === 'access_denied' ? 'Spotify login was cancelled.' : `Spotify login failed (${oauthError}).`
    void router.replace({ name: 'login' })
    return
  }
  if (typeof code === 'string') {
    busy.value = true
    try {
      const { tokens, purpose } = await completeLogin(code, typeof state === 'string' ? state : null)
      if (purpose.type === 'tv') {
        // A login made for a TV: hand it over there instead of signing this browser in.
        sessionStorage.setItem(TV_GRANT_KEY, JSON.stringify(tokens))
        await router.replace({ name: 'tv-connect', query: { code: purpose.room } })
        return
      }
      auth.signIn(tokens)
      await router.replace({ name: 'dashboard' })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed.'
      busy.value = false
      void router.replace({ name: 'login' })
    }
    return
  }
  if (auth.isAuthenticated) void router.replace({ name: 'dashboard' })
})

async function login() {
  busy.value = true
  error.value = null
  try {
    await beginLogin()
  } catch (err) {
    busy.value = false
    error.value = window.isSecureContext
      ? `Couldn't start Spotify login: ${err instanceof Error ? err.message : String(err)}`
      : 'Login needs a secure connection. Open this page over https:// and try again.'
  }
}
</script>

<template>
  <main class="login">
    <div class="glow" aria-hidden="true" />
    <section class="card">
      <img class="logo" :src="logoUrl" alt="" width="96" height="96" />
      <h1>Spotify Television</h1>
      <p class="tagline">Your playlists, as music videos. Lean back and let it play.</p>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button class="btn-primary" :disabled="busy" @click="login">
        {{ busy ? 'Connecting…' : 'Log in with Spotify' }}
      </button>
      <a class="signup" href="https://www.spotify.com/signup" target="_blank" rel="noopener">
        Don't have Spotify? Sign up
      </a>
    </section>
  </main>
</template>

<style scoped>
.login {
  position: relative;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  overflow: hidden;
}
.glow {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(40% 40% at 30% 30%, rgb(119 201 212 / 0.35), transparent 70%),
    radial-gradient(40% 40% at 70% 70%, rgb(87 220 144 / 0.3), transparent 70%);
  filter: blur(40px);
}
.card {
  position: relative;
  width: min(420px, 100%);
  padding: 40px 32px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  background: rgb(18 22 27 / 0.75);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 30px 80px rgb(0 0 0 / 0.5);
}
.logo {
  filter: drop-shadow(0 8px 24px rgb(87 220 144 / 0.35));
}
h1 {
  margin: 0;
  font-size: 1.75rem;
  letter-spacing: -0.02em;
}
.tagline {
  margin: 0 0 8px;
  color: var(--text-muted);
}
.error {
  margin: 0;
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius);
  background: rgb(255 92 92 / 0.12);
  border: 1px solid rgb(255 92 92 / 0.35);
  color: #ffb3b3;
  font-size: 0.9rem;
}
.btn-primary {
  width: 100%;
}
.signup {
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
