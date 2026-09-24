// A TV can follow Spotify on its own with a Spotify login of its own. Typing a password with
// a TV remote is miserable, so the login happens on a phone: the TV shows a QR code for
// /tv/connect, the phone makes a separate grant (not its own session), and sends it to the
// TV through the pairing room. The Worker relays it without storing it.

/** The only permission the TV gets: reading what's playing. */
export const TV_SCOPES = ['user-read-playback-state']

/** Phone side: the fresh grant, kept in sessionStorage between the redirect and the handoff. */
export const TV_GRANT_KEY = 'stv:tv-grant'

/** TV side: where the TV keeps its login. */
export const TV_TOKENS_KEY = 'stv:tv-spotify'
