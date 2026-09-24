export const config = {
  spotifyClientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
  // Derived rather than configured so dev and prod can't drift. Must exactly match a
  // redirect URI registered in the Spotify developer dashboard.
  redirectUri: new URL(`${import.meta.env.BASE_URL}login`, window.location.origin).toString(),
  workerUrl: import.meta.env.VITE_WORKER_URL.replace(/\/$/, ''),
  spotifyScopes: ['playlist-read-private', 'playlist-read-collaborative', 'user-library-read'],
}
