!["Logo"](./src/assets/spotify-mtv-logo.svg)

# Spotify Television

Watch your Spotify playlists as a stream of music videos. Log in with Spotify, pick a playlist, and each song plays its YouTube video, advancing through the playlist like a TV channel.

Press coverage: [Hypebot, 2018](http://www.hypebot.com/hypebot/2018/03/spotify-television-turns-playlists-into-youtube-stream.html)

## How it works

```
Browser (Vue 3 SPA on GitHub Pages)                 Cloudflare Worker (worker/)
┌───────────────────────────────────────┐          ┌───────────────────────────────┐
│ auth store ── PKCE login + refresh    │          │ GET /v1/video?trackId=…       │
│ library store ── playlists, tracks ───┼─► Spotify│  1. KV cache hit? return it   │
│ player store ── queue, shuffle/repeat │   Web API│  2. verify track via Spotify  │
│      │                                │          │     (caller's access token)   │
│      ├─ video-lookup ─────────────────┼─────────►│  3. YouTube search, rank,     │
│      │   (IndexedDB cache)            │          │     cache in KV forever       │
│      ▼                                │          └───────────────────────────────┘
│ VideoPlayer interface                 │
│   └─ LocalYouTubePlayer (IFrame API)  │
└───────────────────────────────────────┘
```

- **Auth** (`src/lib/spotify/auth.ts`, `src/stores/auth.ts`): Authorization Code with PKCE, entirely client-side. Tokens persist in localStorage and refresh automatically.
- **Library** (`src/stores/library.ts`): streams all playlists into the sidebar page by page on login. A playlist's songs (including Liked Songs) load when it's first expanded.
- **Playback** (`src/stores/player.ts`, `src/lib/queue.ts`): queue order, shuffle and repeat are pure functions with tests. The store drives a `VideoPlayer` interface (`src/lib/player/types.ts`) and never touches the YouTube iframe directly. That's the seam for casting: a TV target is just another `VideoPlayer`.
- **Key rotation** (`worker/src/keys.ts`): `YOUTUBE_API_KEYS` can hold several keys. Each search picks its first key by arrival time, fails over when a key is out of quota, and records exhausted keys in KV until the midnight-Pacific reset so every isolate skips them. Keys must not be HTTP-referrer restricted (server requests have no referrer); restrict them to the YouTube Data API instead.
- **Video lookup** (`worker/`): a YouTube search costs 100 of a key's 10,000 daily quota units. The Worker keeps the API key off the client and caches every match for everyone, so each song is searched at most once, ever. Cache misses require a valid Spotify token, so the quota can't be spent on arbitrary queries.

### Spotify API constraints (2026)

Spotify's [February 2026 changes](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) apply to development-mode apps:

- Playlist contents are only returned for playlists the user **owns or collaborates on**. Followed playlists show a lock icon.
- Only users added to the app's allowlist in the Spotify developer dashboard can log in (capped at 5 for new apps), and the app owner needs Premium.

## Development

Requires Node 20.19+.

```sh
npm install
npm run dev          # http://127.0.0.1:4200
npm test             # vitest (app + worker logic)
npm run build
```

The dev server must run on `127.0.0.1:4200` because that's the redirect URI registered with Spotify, and Spotify no longer accepts `localhost`. Redirect URIs to register in the [Spotify dashboard](https://developer.spotify.com/dashboard):

- `http://127.0.0.1:4200/login`
- `https://immannino.github.io/SpotifyTelevision/login`

### Running the Worker locally

```sh
cd worker && npm install
cp .dev.vars.example .dev.vars   # add YouTube Data API v3 keys
cd .. && npm run worker:dev      # http://127.0.0.1:8787, uses local KV
```

`.env` points the app at `http://127.0.0.1:8787` by default. Put overrides in `.env.local`.

## Deployment

**Worker** (one time):

```sh
cd worker
npx wrangler kv namespace create VIDEO_CACHE   # paste the id into wrangler.jsonc
npx wrangler secret put YOUTUBE_API_KEYS      # comma-separated
npm run deploy
```

**App**: `.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every push to `master`. One-time setup:

1. Settings → Pages → Source: **GitHub Actions** (it previously served `docs/` from the branch).
2. Settings → Secrets and variables → Actions → Variables: `VIDEO_LOOKUP_URL` = the deployed Worker URL.

## Roadmap: casting to a TV

Playback state is plain, serializable data, and the store only talks to the `VideoPlayer` interface, so a remote player can replace the local one. Two routes:

1. **`/tv` receiver page + pairing**: open the app on any smart-TV, console or Fire TV browser, which shows a short code; the phone becomes a remote. Commands go through a small relay, such as a Durable Object added to the existing Worker. Works on the most devices.
2. **Google Cast Web Receiver**: a custom receiver page that hosts the YouTube IFrame on a Chromecast. Feels more native, but it's Cast-only and needs a registered Cast app.
