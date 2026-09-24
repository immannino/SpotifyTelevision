<script setup lang="ts">
import { computed } from 'vue'
import { LIKED_SONGS_ID, type Playlist } from '@/lib/models'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ playlist: Playlist; expanded: boolean; isPlayingSource: boolean }>()
defineEmits<{ toggle: [] }>()

const library = useLibraryStore()
const player = usePlayerStore()

const list = computed(() => library.lists[props.playlist.id])
const isLiked = computed(() => props.playlist.id === LIKED_SONGS_ID)
const subtitle = computed(() => {
  const { total, ownerName, readable } = props.playlist
  const parts = [total !== null ? `${total} songs` : null, ownerName ? `by ${ownerName}` : null]
  if (!readable) parts.push('view only on Spotify')
  return parts.filter(Boolean).join(' · ')
})
const progress = computed(() => {
  const l = list.value
  return l?.total ? Math.round((l.fetched / l.total) * 100) : 0
})

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <div class="playlist" :class="{ expanded, source: isPlayingSource }">
    <button class="row" :aria-expanded="expanded" @click="$emit('toggle')">
      <span class="art" :class="{ liked: isLiked }">
        <AppIcon v-if="isLiked" name="heart" :size="20" />
        <img v-else-if="playlist.artworkUrl" :src="playlist.artworkUrl" alt="" loading="lazy" />
        <AppIcon v-else name="music" :size="20" />
      </span>
      <span class="text">
        <span class="name">{{ playlist.name }}</span>
        <span class="sub">{{ subtitle }}</span>
      </span>
      <AppIcon v-if="!playlist.readable" name="lock" :size="16" class="lock" />
      <AppIcon name="chevron" :size="20" class="chevron" />
    </button>

    <div v-if="expanded && list" class="tracks">
      <div v-if="list.status === 'loading'" class="progress" role="progressbar" :aria-valuenow="progress">
        <span :style="{ width: `${progress}%` }" />
      </div>
      <p v-if="list.status === 'error'" class="notice error">
        {{ list.error }}
        <button class="link" @click="library.loadTracks(playlist.id)">Retry</button>
      </p>
      <p v-else-if="list.status === 'done' && !list.tracks.length" class="notice">No songs here.</p>

      <ol>
        <li v-for="(track, i) in list.tracks" :key="i">
          <button
            class="track"
            :class="{ current: isPlayingSource && player.currentIndex === i }"
            :disabled="!track.playable"
            :title="track.playable ? undefined : 'Local files can’t be matched to videos'"
            @click="player.playFrom(playlist.id, i)"
          >
            <span class="index">
              <span v-if="isPlayingSource && player.currentIndex === i" class="eq" :class="{ paused: !player.isPlaying }">
                <i /><i /><i />
              </span>
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span class="text">
              <span class="name">{{ track.name }}</span>
              <span class="sub">{{ track.artists.join(', ') }}</span>
            </span>
            <span class="duration">{{ formatDuration(track.durationMs) }}</span>
          </button>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.playlist {
  border-radius: var(--radius);
}
.playlist.expanded {
  background: rgb(255 255 255 / 0.03);
}
.row,
.track {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px;
  border-radius: var(--radius);
  text-align: left;
  color: inherit;
}
.row:hover,
.track:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.06);
}
.art {
  flex: none;
  width: 44px;
  height: 44px;
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
.art.liked {
  background: linear-gradient(135deg, #4f3cc9, #9fd1c9);
  color: #fff;
}
.text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name,
.sub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name {
  font-weight: 500;
}
.source > .row .name {
  color: var(--accent);
}
.sub {
  font-size: 0.8rem;
  color: var(--text-muted);
}
.lock {
  color: var(--text-muted);
}
.chevron {
  color: var(--text-muted);
  transition: transform 0.2s;
}
.expanded .chevron {
  transform: rotate(90deg);
}

.tracks {
  padding: 0 0 8px;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  /* Lets the browser skip layout for off-screen rows in long playlists. */
  content-visibility: auto;
  contain-intrinsic-size: auto 52px;
}
.track {
  padding: 6px 8px;
}
.track:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.track.current .name {
  color: var(--accent);
}
.index {
  flex: none;
  width: 28px;
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.duration {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}
.eq i {
  width: 3px;
  background: var(--accent);
  animation: eq 0.9s ease-in-out infinite;
}
.eq i:nth-child(2) {
  animation-delay: -0.3s;
}
.eq i:nth-child(3) {
  animation-delay: -0.6s;
}
.eq.paused i {
  animation-play-state: paused;
}
@keyframes eq {
  0%,
  100% {
    height: 30%;
  }
  50% {
    height: 100%;
  }
}
.progress {
  height: 2px;
  margin: 0 8px 6px;
  background: var(--surface-2);
  border-radius: 1px;
  overflow: hidden;
}
.progress span {
  display: block;
  height: 100%;
  background: var(--gradient);
  transition: width 0.3s;
}
.notice {
  margin: 8px 12px;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.notice.error {
  color: #ffb3b3;
}
</style>
