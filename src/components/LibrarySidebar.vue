<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import AppIcon from './AppIcon.vue'
import FollowSpotifyRow from './FollowSpotifyRow.vue'
import PlaylistRow from './PlaylistRow.vue'

const auth = useAuthStore()
const library = useLibraryStore()
const player = usePlayerStore()

const query = ref('')
const expandedId = ref<string | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? library.playlists.filter((p) => p.name.toLowerCase().includes(q)) : library.playlists
})

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
  if (expandedId.value) void library.loadTracks(id)
}

const avatar = computed(() => library.user?.images.at(-1)?.url ?? null)
</script>

<template>
  <aside class="sidebar" aria-label="Your library">
    <header class="header">
      <div class="user">
        <img v-if="avatar" :src="avatar" alt="" class="avatar" />
        <span v-else class="avatar placeholder">{{ library.user?.display_name?.[0] ?? '♪' }}</span>
        <div class="user-text">
          <span class="app-name">Spotify Television</span>
          <span class="user-name">{{ library.user?.display_name ?? 'Loading…' }}</span>
        </div>
      </div>
      <button class="icon-btn" title="Log out" aria-label="Log out" @click="auth.logout()">
        <AppIcon name="logout" :size="20" />
      </button>
    </header>

    <FollowSpotifyRow />

    <label class="search">
      <AppIcon name="search" :size="18" />
      <input v-model="query" type="search" placeholder="Filter playlists" aria-label="Filter playlists" />
    </label>

    <div class="list">
      <p v-if="library.status === 'error'" class="notice error" role="alert">
        {{ library.error }}
        <button class="link" @click="library.loadLibrary">Try again</button>
      </p>

      <PlaylistRow
        v-for="playlist in filtered"
        :key="playlist.id"
        :playlist="playlist"
        :expanded="expandedId === playlist.id"
        :is-playing-source="player.playlistId === playlist.id"
        @toggle="toggle(playlist.id)"
      />

      <p v-if="library.status === 'loading'" class="notice">Loading playlists… {{ library.playlists.length || '' }}</p>
      <p v-else-if="library.status === 'done' && !filtered.length" class="notice">No playlists match “{{ query }}”.</p>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgb(12 15 19 / 0.85);
  backdrop-filter: blur(24px);
  border-left: 1px solid var(--border);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
}
.user {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar.placeholder {
  display: grid;
  place-items: center;
  background: var(--gradient);
  color: #06140c;
  font-weight: 700;
}
.user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.app-name {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--gradient);
  background-clip: text;
  color: transparent;
  font-weight: 700;
}
.user-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px 12px;
  padding: 0 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text-muted);
  border: 1px solid transparent;
}
.search:focus-within {
  border-color: var(--accent);
}
.search input {
  flex: 1;
  min-width: 0;
  padding: 10px 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  outline: none;
}
.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 24px;
  overscroll-behavior: contain;
}
.notice {
  margin: 12px 8px;
  color: var(--text-muted);
  font-size: 0.9rem;
}
.notice.error {
  color: #ffb3b3;
}

@media (max-width: 900px) {
  .sidebar {
    border-left: 0;
    border-top: 1px solid var(--border);
  }
}
</style>
