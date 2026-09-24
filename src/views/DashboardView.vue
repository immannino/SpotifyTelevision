<script setup lang="ts">
import { computed, onMounted } from 'vue'
import LibrarySidebar from '@/components/LibrarySidebar.vue'
import NowPlaying from '@/components/NowPlaying.vue'
import VideoStage from '@/components/VideoStage.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { normalizeCode } from '@/lib/cast/socket'
import { PENDING_CAST_KEY } from '@/router'
import { useMediaSession } from '@/composables/useMediaSession'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'

const library = useLibraryStore()
const player = usePlayerStore()

useKeyboardShortcuts()
useMediaSession()
onMounted(() => {
  void library.loadLibrary()

  // Scanned the TV's QR code: pair right away. Otherwise rejoin a TV from before a reload.
  const pending = normalizeCode(sessionStorage.getItem(PENDING_CAST_KEY) ?? '')
  sessionStorage.removeItem(PENDING_CAST_KEY)
  if (pending) player.connectTv(pending)
  else player.resumeCasting()
})

const backdrop = computed(() => (player.currentTrack?.artworkUrl ? `url("${player.currentTrack.artworkUrl}")` : 'none'))
</script>

<template>
  <div class="dashboard">
    <div class="backdrop" :style="{ backgroundImage: backdrop }" aria-hidden="true" />
    <main class="stage-column">
      <VideoStage />
      <NowPlaying />
    </main>
    <LibrarySidebar />
  </div>
</template>

<style scoped>
.dashboard {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  height: 100dvh;
  overflow: hidden;
}
.backdrop {
  position: absolute;
  inset: -10%;
  z-index: -1;
  background: var(--bg) center / cover no-repeat;
  filter: blur(90px) saturate(1.4);
  opacity: 0.35;
  transition: background-image 0.8s;
}
.stage-column {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  padding: 24px clamp(16px, 3vw, 40px);
  min-width: 0;
  min-height: 0;
}

@media (max-width: 900px) {
  .dashboard {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .stage-column {
    padding: 0 0 12px;
    gap: 12px;
  }
}
</style>
