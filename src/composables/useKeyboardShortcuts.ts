import { onBeforeUnmount, onMounted } from 'vue'
import { useFollowStore } from '@/stores/follow'
import { usePlayerStore } from '@/stores/player'

export const SHORTCUTS = [
  { keys: 'Space / K', action: 'Play / pause' },
  { keys: 'N / Shift →', action: 'Next song' },
  { keys: 'P / Shift ←', action: 'Previous song' },
  { keys: 'S', action: 'Shuffle' },
  { keys: 'R', action: 'Repeat mode' },
]

export function useKeyboardShortcuts() {
  const player = usePlayerStore()
  const follow = useFollowStore()
  // While following, play/pause and skipping go to the Spotify app instead of our queue.
  const togglePlay = () => (follow.active ? follow.togglePlay() : player.togglePlay())
  const next = () => (follow.active ? void follow.control('next') : player.next())
  const previous = () => (follow.active ? void follow.control('previous') : player.previous())

  function onKeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable]')) return
    // Let Space/Enter activate a focused button normally.
    if (e.key === ' ' && target?.closest('button')) return

    const key = e.key.toLowerCase()
    const handlers: Record<string, () => void> = {
      ' ': togglePlay,
      k: togglePlay,
      n: next,
      p: previous,
      s: player.toggleShuffle,
      r: player.cycleRepeat,
    }
    const handler =
      e.shiftKey && key === 'arrowright' ? next : e.shiftKey && key === 'arrowleft' ? previous : handlers[key]
    if (!handler) return
    e.preventDefault()
    handler()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
