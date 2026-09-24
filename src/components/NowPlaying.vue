<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFollowStore } from '@/stores/follow'
import { usePlayerStore } from '@/stores/player'
import AppIcon from './AppIcon.vue'
import CastDialog from './CastDialog.vue'

const player = usePlayerStore()
const follow = useFollowStore()
// After a reload while casting, the local queue is gone but the TV still knows its song.
const track = computed(() => player.currentTrack ?? player.tvItem?.track ?? null)
const canPlayPause = computed(() => (player.isCasting ? player.castState === 'connected' : !!player.currentVideo))
const castOpen = ref(false)
const repeatLabel = computed(() => ({ off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' })[player.repeat])
</script>

<template>
  <section class="now-playing" aria-label="Now playing">
    <div class="meta">
      <div class="art">
        <img v-if="track?.artworkUrl" :src="track.artworkUrl" alt="" />
        <AppIcon v-else name="music" />
      </div>
      <div class="text">
        <p class="title">{{ track?.name ?? 'Nothing playing' }}</p>
        <p class="artist">
          <span v-if="player.castState === 'connected'" class="on-tv">On TV · </span>
          <span v-else-if="follow.active" class="on-tv">Following Spotify · </span>
          {{ track ? track.artists.join(', ') : 'Choose a song to begin' }}
        </p>
      </div>
    </div>

    <div class="controls">
      <!-- While following, these control the Spotify app itself rather than our queue. -->
      <template v-if="follow.active">
        <template v-if="follow.canControl">
          <button class="icon-btn" title="Previous on Spotify (P)" aria-label="Previous on Spotify" @click="follow.control('previous')">
            <AppIcon name="previous" />
          </button>
          <button
            class="play-btn"
            :title="follow.status === 'playing' ? 'Pause Spotify (Space)' : 'Play Spotify (Space)'"
            :aria-label="follow.status === 'playing' ? 'Pause Spotify' : 'Play Spotify'"
            @click="follow.togglePlay"
          >
            <AppIcon :name="follow.status === 'playing' ? 'pause' : 'play'" :size="28" />
          </button>
          <button class="icon-btn" title="Next on Spotify (N)" aria-label="Next on Spotify" @click="follow.control('next')">
            <AppIcon name="next" />
          </button>
        </template>
        <button v-else-if="follow.needsControlPermission" class="link enable-controls" @click="follow.grantPermission">
          Enable controls
        </button>
        <button class="stop-follow" @click="follow.stop">Stop following</button>
      </template>
      <template v-else>
        <button
          class="icon-btn"
          :class="{ on: player.shuffle }"
          :aria-pressed="player.shuffle"
          title="Shuffle (S)"
          aria-label="Shuffle"
          @click="player.toggleShuffle"
        >
          <AppIcon name="shuffle" :size="20" />
        </button>
        <button class="icon-btn" title="Previous (P)" aria-label="Previous" :disabled="!player.currentTrack" @click="player.previous">
          <AppIcon name="previous" />
        </button>
        <button
          class="play-btn"
          :title="player.isPlaying ? 'Pause (Space)' : 'Play (Space)'"
          :aria-label="player.isPlaying ? 'Pause' : 'Play'"
          :disabled="!canPlayPause"
          @click="player.togglePlay"
        >
          <AppIcon :name="player.isPlaying ? 'pause' : 'play'" :size="28" />
        </button>
        <button class="icon-btn" title="Next (N)" aria-label="Next" :disabled="!player.currentTrack" @click="player.next()">
          <AppIcon name="next" />
        </button>
        <button
          class="icon-btn"
          :class="{ on: player.repeat !== 'off' }"
          :title="`${repeatLabel} (R)`"
          :aria-label="repeatLabel"
          @click="player.cycleRepeat"
        >
          <AppIcon :name="player.repeat === 'one' ? 'repeatOne' : 'repeat'" :size="20" />
        </button>
      </template>
      <button
        class="icon-btn cast-btn"
        :class="{ on: player.isCasting }"
        :title="player.isCasting ? 'Casting to TV' : 'Watch on a TV'"
        :aria-label="player.isCasting ? 'Casting to TV' : 'Watch on a TV'"
        @click="castOpen = true"
      >
        <AppIcon :name="player.isCasting ? 'castConnected' : 'cast'" :size="20" />
      </button>
    </div>
    <p v-if="follow.controlError" class="control-error" role="alert">{{ follow.controlError }}</p>
    <CastDialog v-model:open="castOpen" />
  </section>
</template>

<style scoped>
.now-playing {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  width: 100%;
  padding: 12px 16px 12px 12px;
  background: rgb(18 22 27 / 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.meta {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.art {
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--surface-2);
  color: var(--text-muted);
}
.art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.text {
  min-width: 0;
}
.title,
.artist {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title {
  font-weight: 600;
  font-size: 1.05rem;
}
.artist {
  color: var(--text-muted);
  font-size: 0.9rem;
}
.controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn.on {
  color: var(--accent);
}
.cast-btn {
  margin-left: 8px;
}
.enable-controls {
  margin-right: 8px;
  font-size: 0.9rem;
}
.control-error {
  grid-column: 1 / -1;
  margin: 0;
  color: #ffb3b3;
  font-size: 0.85rem;
}
.stop-follow {
  margin-left: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text);
  font-weight: 600;
}
.stop-follow:hover {
  background: rgb(255 255 255 / 0.08);
}
.on-tv {
  color: var(--accent);
  font-weight: 600;
}
.play-btn {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #06140c;
  background: var(--gradient);
  transition:
    transform 0.15s,
    opacity 0.15s;
}
.play-btn:hover:not(:disabled) {
  transform: scale(1.06);
}
.play-btn:disabled {
  opacity: 0.4;
}

@media (max-width: 900px) {
  .now-playing {
    grid-template-columns: 1fr;
    gap: 10px;
    margin-inline: 12px;
    width: auto;
  }
  .controls {
    justify-content: center;
  }
}
</style>
