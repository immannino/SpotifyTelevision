/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID: string
  readonly VITE_VIDEO_LOOKUP_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
