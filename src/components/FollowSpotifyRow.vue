<script setup lang="ts">
import { computed } from 'vue'
import { useFollowStore } from '@/stores/follow'
import AppIcon from './AppIcon.vue'

const follow = useFollowStore()

const subtitle = computed(() => {
  const device = follow.device ?? 'Spotify'
  switch (follow.status) {
    case 'starting':
      return 'Checking Spotify…'
    case 'waiting':
      return 'Play something in any Spotify app'
    case 'playing':
      return `Playing on ${device}`
    case 'paused':
      return `Paused on ${device}`
    case 'error':
      return follow.error ?? "Couldn't reach Spotify"
    case 'needs-permission':
      return 'Needs permission to see what’s playing'
    default:
      return 'Play in any Spotify app; the video follows'
  }
})
</script>

<template>
  <div class="follow" :class="{ active: follow.active }">
    <span class="art" aria-hidden="true">
      <AppIcon name="sync" :size="22" :class="{ spinning: follow.status === 'playing' }" />
    </span>
    <span class="text">
      <span class="name">Follow my Spotify</span>
      <span class="sub" role="status">{{ subtitle }}</span>
    </span>
    <button v-if="follow.status === 'needs-permission'" class="allow" @click="follow.grantPermission">Allow</button>
    <button
      v-else
      class="switch"
      role="switch"
      :aria-checked="follow.active"
      aria-label="Follow my Spotify"
      @click="follow.toggle"
    >
      <span class="knob" />
    </button>
  </div>
</template>

<style scoped>
.follow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 16px 12px;
  padding: 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: rgb(255 255 255 / 0.03);
  transition:
    border-color 0.2s,
    background 0.2s;
}
.follow.active {
  border-color: rgb(87 220 144 / 0.45);
  background: rgb(87 220 144 / 0.08);
}
.art {
  flex: none;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--gradient);
  color: #06140c;
}
.spinning {
  animation: spin 3s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.text {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font-weight: 600;
}
.sub {
  font-size: 0.8rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.active .sub {
  color: var(--accent);
}
.switch {
  flex: none;
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  transition: background 0.2s;
}
.switch[aria-checked='true'] {
  background: var(--accent);
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.switch[aria-checked='true'] .knob {
  transform: translateX(18px);
}
.allow {
  flex: none;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--gradient);
  color: #06140c;
  font-weight: 700;
  font-size: 0.85rem;
}
</style>
