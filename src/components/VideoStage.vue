<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { createLocalYouTubePlayer } from '@/lib/player/youtube-iframe'
import type { VideoPlayer } from '@/lib/player/types'
import { usePlayerStore } from '@/stores/player'
import AppIcon from './AppIcon.vue'

const player = usePlayerStore()
const mount = useTemplateRef<HTMLElement>('mount')
const loadError = ref(false)
const castTrack = computed(() => player.currentTrack ?? player.tvItem?.track ?? null)
const castStatus = computed(
  () =>
    ({ off: '', connecting: 'Connecting to your TV…', 'waiting-for-tv': 'Waiting for the TV…', connected: 'Playing on your TV' })[
      player.castState
    ],
)

let instance: VideoPlayer | null = null
let unmounted = false

onMounted(async () => {
  try {
    const created = await createLocalYouTubePlayer(mount.value!, player.playerEvents)
    if (unmounted) return created.destroy()
    instance = created
    player.attachPlayer(created)
  } catch {
    loadError.value = true
  }
})

onBeforeUnmount(() => {
  unmounted = true
  player.detachPlayer()
  instance?.destroy()
})
</script>

<template>
  <section class="stage" aria-label="Video">
    <div class="frame" :class="{ live: player.currentVideo && !player.isCasting }">
      <!-- The IFrame API replaces this element with the player iframe. -->
      <div ref="mount" />
    </div>

    <div v-if="player.isCasting" class="overlay casting">
      <img v-if="castTrack?.artworkUrl" class="cast-art" :src="castTrack.artworkUrl" alt="" />
      <AppIcon v-else name="castConnected" :size="56" class="cast-icon" />
      <p class="headline">{{ player.tvFailing ? 'Videos aren’t playing on your TV' : castStatus }}</p>
      <p v-if="player.tvFailing" class="sub">Several in a row failed. Try another song, or reload the TV page.</p>
      <p v-if="castTrack" class="sub">{{ castTrack.name }} · {{ castTrack.artists.join(', ') }}</p>
      <p class="sub small">TV code <strong>{{ player.castCode }}</strong></p>
      <button class="link" @click="player.disconnectTv()">Play on this device instead</button>
    </div>

    <div v-else-if="!player.currentVideo" class="overlay">
      <template v-if="loadError">
        <p class="headline">The YouTube player couldn't load.</p>
        <p class="sub">Check that youtube.com isn't blocked, then reload.</p>
      </template>
      <template v-else-if="player.video.kind === 'searching'">
        <div class="spinner" aria-hidden="true" />
        <p class="sub">Finding the video for <strong>{{ player.currentTrack?.name }}</strong>…</p>
      </template>
      <template v-else-if="player.video.kind === 'error'">
        <p class="headline">{{ player.currentTrack?.name }}</p>
        <p class="sub" role="status">{{ player.video.message }}</p>
      </template>
      <template v-else>
        <p class="headline">Pick a song to start the show</p>
        <p class="sub">Open a playlist on the right, then choose any track.</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.stage {
  position: relative;
  /* As wide as the column allows, but short enough to leave room for the controls. */
  width: min(100%, calc((100dvh - 180px) * 16 / 9));
  aspect-ratio: 16 / 9;
  margin-inline: auto;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: #000;
  box-shadow: 0 30px 80px rgb(0 0 0 / 0.55);
}
.frame {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.4s;
}
.frame.live {
  opacity: 1;
}
.frame :deep(iframe) {
  width: 100%;
  height: 100%;
  border: 0;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  background: radial-gradient(60% 60% at 50% 40%, rgb(87 220 144 / 0.12), transparent), #07090b;
}
.headline {
  margin: 0;
  font-size: clamp(1.1rem, 2.4vw, 1.6rem);
  font-weight: 600;
}
.sub {
  margin: 0;
  color: var(--text-muted);
}
.casting {
  gap: 10px;
}
.cast-art {
  width: clamp(96px, 18vw, 180px);
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--radius);
  box-shadow: 0 20px 60px rgb(0 0 0 / 0.6);
  margin-bottom: 8px;
}
.cast-icon {
  color: var(--accent);
  margin-bottom: 4px;
}
.small {
  font-size: 0.85rem;
}
.small strong {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  letter-spacing: 0.1em;
  color: var(--text);
}
.link {
  margin-top: 6px;
}
.spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid rgb(255 255 255 / 0.12);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
  margin-bottom: 8px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .stage {
    border-radius: 0;
    width: 100%;
  }
}
</style>
