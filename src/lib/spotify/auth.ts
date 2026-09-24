// Spotify Authorization Code flow with PKCE. No client secret is involved, so this runs
// entirely in the browser. https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
import { config } from '@/config'
import type { TokenResponse } from './types'

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const PENDING_KEY = 'stv:pkce'

export interface Tokens {
  accessToken: string
  refreshToken: string
  /** Epoch ms. */
  expiresAt: number
  /** Space-separated scopes granted. Missing on tokens saved before scopes were tracked. */
  scope?: string
}

export class AuthError extends Error {}

export async function beginLogin(): Promise<never> {
  const verifier = randomString(64)
  const state = randomString(16)
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }))

  const url = new URL(AUTHORIZE_URL)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.spotifyClientId,
    scope: config.spotifyScopes.join(' '),
    code_challenge_method: 'S256',
    code_challenge: base64Url(await sha256(verifier)),
    redirect_uri: config.redirectUri,
    state,
  }).toString()

  window.location.assign(url)
  // Navigation is underway; never resolve so callers don't continue rendering.
  return new Promise<never>(() => {})
}

export async function completeLogin(code: string, state: string | null): Promise<Tokens> {
  const pending = sessionStorage.getItem(PENDING_KEY)
  sessionStorage.removeItem(PENDING_KEY)
  if (!pending) throw new AuthError('Login session expired. Please try again.')

  const { verifier, state: expectedState } = JSON.parse(pending) as { verifier: string; state: string }
  if (state !== expectedState) throw new AuthError('Login response did not match the request. Please try again.')

  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  })
}

export async function refreshTokens(refreshToken: string): Promise<Tokens> {
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
  // Spotify may or may not rotate the refresh token; keep the old one if it doesn't.
  return { ...tokens, refreshToken: tokens.refreshToken || refreshToken }
}

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.spotifyClientId, ...params }),
  })
  const body = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error_description?: string }
  if (!res.ok || !body.access_token) {
    throw new AuthError(body.error_description ?? `Spotify token request failed (${res.status}).`)
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? '',
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    scope: body.scope,
  }
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (x) => chars[x % chars.length]).join('')
}

function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain))
}

function base64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
