import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
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
})
