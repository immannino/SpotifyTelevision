/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID: string
  readonly VITE_WORKER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
