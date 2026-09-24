<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { createLocalYouTubePlayer } from '@/lib/player/youtube-iframe'
import type { VideoPlayer } from '@/lib/player/types'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const mount = useTemplateRef<HTMLElement>('mount')
const loadError = ref(false)

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
    <div class="frame" :class="{ live: player.currentVideo }">
      <!-- The IFrame API replaces this element with the player iframe. -->
      <div ref="mount" />
    </div>

    <div v-if="!player.currentVideo" class="overlay">
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
