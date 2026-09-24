<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useLibraryStore } from './stores/library'
import { usePlayerStore } from './stores/player'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

// Logging out, or a refresh token that no longer works, ends the session wherever you are.
watch(
  () => auth.isAuthenticated,
  (authed) => {
    if (authed) return
    usePlayerStore().stop()
    useLibraryStore().reset()
    if (route.meta.requiresAuth) void router.replace({ name: 'login' })
  },
)
</script>

<template>
  <RouterView />
</template>
