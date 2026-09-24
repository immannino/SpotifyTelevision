import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, mode }) => {
  // Without this the app silently requests /v1/video from its own origin and 404s.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (command === 'build' && !/^https?:\/\//.test(env.VITE_WORKER_URL ?? '')) {
    throw new Error(`VITE_WORKER_URL must be an absolute URL, got "${env.VITE_WORKER_URL ?? ''}"`)
  }

  return {
    // GitHub Pages serves the app from /SpotifyTelevision/; CI sets VITE_BASE.
    base: process.env.VITE_BASE ?? '/',
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // Spotify only accepts loopback IPs (not "localhost") for http redirect URIs,
      // and this matches the redirect URI already registered for the app.
      host: '127.0.0.1',
      port: 4200,
      strictPort: true,
    },
  }
})
