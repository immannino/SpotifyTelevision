!["Logo"](./src/assets/spotify-mtv-logo.svg)

# Spotify Television

Watch your Spotify playlists as a stream of music videos. Log in with Spotify, pick a playlist, and each song plays its YouTube video, advancing through the playlist like a TV channel. Cast it to any TV with a web browser, using your phone as the remote.

Live at **https://tv.ope.cool** (TV mode: **https://tv.ope.cool/tv**).

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
│      ├─ local: YouTube IFrame         │          │                               │
│      └─ casting: room socket ─────────┼─────────►│ Room Durable Object (per code)│
└───────────────────────────────────────┘          │  relays phone ⇄ TV messages   │
                                                   └──────────────┬────────────────┘
TV browser (/tv): TvReceiver + YouTube IFrame ◄───────────────────┘
```

- **Auth** (`src/lib/spotify/auth.ts`, `src/stores/auth.ts`): Authorization Code with PKCE, entirely client-side. Tokens persist in localStorage and refresh automatically.
- **Library** (`src/stores/library.ts`): streams all playlists into the sidebar page by page on login. A playlist's songs (including Liked Songs) load when it's first expanded.
- **Playback** (`src/stores/player.ts`, `src/lib/queue.ts`): queue order, shuffle and repeat are pure functions with tests. The store plays through the local YouTube iframe, or sends the queue to a TV while casting.
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
- `https://tv.ope.cool/login`

### Running the Worker locally

```sh
cd worker && npm install
cp .dev.vars.example .dev.vars   # add YouTube Data API v3 keys
cd .. && npm run worker:dev      # http://127.0.0.1:8787, uses local KV
```

`.env` points the app at the deployed Worker. To use the local one, put `VITE_WORKER_URL=http://127.0.0.1:8787` in `.env.local` (gitignored).

## Deployment

**Worker** (one time):

```sh
cd worker
npx wrangler kv namespace create VIDEO_CACHE   # paste the id into wrangler.jsonc
npx wrangler secret put YOUTUBE_API_KEYS      # comma-separated
npm run deploy
```

**App**: `.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every push to `main`. One-time setup:

1. Settings → Pages → Source: **GitHub Actions** (it previously served `docs/` from the branch).
2. Set `VITE_WORKER_URL` in `.env` to the deployed Worker URL (it's public). The build fails if it's missing or not an absolute URL.

## TV mode

1. On the TV's browser (smart TV, Fire TV, console, or a laptop on HDMI), open `/tv` and press **Start TV mode**. That press is the user gesture browsers require before videos can play with sound. The TV then shows a 6-character code and a QR code.
2. On your phone, scan the QR code, or tap the cast button next to the player controls and enter the code.

The TV never needs a Spotify login. The phone keeps the queue (shuffle, repeat, Spotify access) and sends the TV the current song plus the next 3 with their videos already resolved. The TV plays through those on its own, so it keeps going while the phone is locked. When the phone wakes it catches up to whatever the TV is on and tops up the queue. Several phones can join one TV.

- **Relay** (`worker/src/room.ts`): one Durable Object per code, using the WebSocket Hibernation API, so idle rooms cost nothing. It replays each side's latest state to anyone reconnecting and wipes rooms after 12 hours idle. A TV that reloads reclaims its code.
- **Protocol** (`src/lib/cast/protocol.ts`): `queue` and `command` messages go phone → TV; `status` goes TV → phone.
- **Receiver** (`src/lib/cast/receiver.ts`): tries the next video candidate when one won't embed, and stops after 3 consecutive failures rather than racing through the playlist.
- **Phone side** (`src/stores/player.ts`): hands off the current position when casting starts, and hands back when you choose "Play on this device instead".

Remaining limitation: if the phone reloads the page while casting, it rejoins the TV and shows what's playing, but the queue beyond the TV's buffered songs is lost until you pick a song again.
