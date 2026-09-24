<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { normalizeCode } from '@/lib/cast/socket'
import { usePlayerStore } from '@/stores/player'
import AppIcon from './AppIcon.vue'

const open = defineModel<boolean>('open', { required: true })

const player = usePlayerStore()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const input = useTemplateRef<HTMLInputElement>('input')
const code = ref('')
const tvUrl = new URL(`${import.meta.env.BASE_URL}tv`, window.location.origin)
const tvUrlLabel = `${tvUrl.host}${tvUrl.pathname}`

const valid = computed(() => normalizeCode(code.value) !== null)
const statusText = computed(
  () =>
    ({
      off: '',
      connecting: 'Connecting…',
      'waiting-for-tv': 'Waiting for the TV to reconnect…',
      connected: 'Playing on your TV',
    })[player.castState],
)

watch(open, async (isOpen) => {
  if (isOpen) {
    dialog.value?.showModal()
    code.value = ''
    await nextTick()
    input.value?.focus()
  } else {
    dialog.value?.close()
  }
})

function connect() {
  const normalized = normalizeCode(code.value)
  if (!normalized) return
  player.connectTv(normalized)
  open.value = false
}

function disconnect() {
  player.disconnectTv()
  open.value = false
}
</script>

<template>
  <dialog ref="dialog" class="cast-dialog" aria-labelledby="cast-title" @close="open = false" @click.self="open = false">
    <header>
      <h2 id="cast-title">{{ player.isCasting ? 'Casting' : 'Watch on a TV' }}</h2>
      <button class="icon-btn" aria-label="Close" @click="open = false"><AppIcon name="close" :size="20" /></button>
    </header>

    <template v-if="player.isCasting">
      <p class="status" :class="player.castState">
        <span class="dot" aria-hidden="true" />{{ statusText }}
      </p>
      <p class="hint">
        Paired with <strong class="code">{{ player.castCode }}</strong>. The TV keeps playing the next few songs even if
        your phone locks.
      </p>
      <button class="btn-primary" @click="disconnect">Play on this device instead</button>
    </template>

    <form v-else @submit.prevent="connect">
      <ol class="steps">
        <li>On your TV's browser, open <strong>{{ tvUrlLabel }}</strong></li>
        <li>Enter the code it shows, or scan its QR code</li>
      </ol>
      <input
        ref="input"
        v-model="code"
        class="code-input"
        inputmode="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="6"
        placeholder="ABC234"
        aria-label="TV code"
      />
      <p v-if="player.castError" class="error" role="alert">{{ player.castError }}</p>
      <button class="btn-primary" type="submit" :disabled="!valid">Connect</button>
    </form>
  </dialog>
</template>

<style scoped>
.cast-dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 20px 24px 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 30px 80px rgb(0 0 0 / 0.6);
}
.cast-dialog::backdrop {
  background: rgb(0 0 0 / 0.6);
  backdrop-filter: blur(4px);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
h2 {
  margin: 0;
  font-size: 1.25rem;
}
form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.steps {
  margin: 0;
  padding-left: 20px;
  color: var(--text-muted);
  line-height: 1.7;
}
.steps strong {
  color: var(--text);
  word-break: break-all;
}
.code-input {
  width: 100%;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font: 700 1.75rem/1 ui-monospace, 'SF Mono', Menlo, monospace;
  letter-spacing: 0.3em;
  text-align: center;
  text-transform: uppercase;
}
.code-input:focus {
  outline: none;
  border-color: var(--accent);
}
.code-input::placeholder {
  color: rgb(255 255 255 / 0.15);
}
.btn-primary {
  width: 100%;
  margin-top: 4px;
}
.error {
  margin: 0;
  color: #ffb3b3;
  font-size: 0.9rem;
}
.status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0 4px;
  font-weight: 600;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f5c542;
}
.status.connected .dot {
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent);
}
.hint {
  margin: 0 0 16px;
  color: var(--text-muted);
}
.code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  color: var(--text);
  letter-spacing: 0.1em;
}
</style>
