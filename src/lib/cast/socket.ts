// A WebSocket into a Worker room that reconnects by itself, including right away when a
// phone wakes up or comes back online.
import { config } from '@/config'

export type RoomRole = 'tv' | 'remote'
export type FatalReason = 'unknown-room' | 'replaced'
export type SocketStatus = 'connecting' | 'open'

export interface RoomSocketHandlers<In> {
  onMessage(message: In): void
  onOpen?(): void
  onStatus?(status: SocketStatus): void
  /** The room rejected us for good; the socket won't reconnect. */
  onFatal?(reason: FatalReason): void
}

export interface RoomSocket<Out> {
  send(message: Out): void
  close(): void
}

// Close codes set by worker/src/room.ts.
const CLOSE_UNKNOWN_ROOM = 4404
const CLOSE_REPLACED = 4000
const PING_INTERVAL_MS = 25_000
const MAX_BACKOFF_MS = 30_000

export function roomSocketUrl(code: string, role: RoomRole): string {
  return `${config.workerUrl.replace(/^http/, 'ws')}/v1/rooms/${encodeURIComponent(code)}/socket?role=${role}`
}

export function openRoomSocket<In, Out>(code: string, role: RoomRole, handlers: RoomSocketHandlers<In>): RoomSocket<Out> {
  let ws: WebSocket | null = null
  let closed = false
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let pingTimer: ReturnType<typeof setInterval> | undefined

  function connect() {
    clearTimeout(retryTimer)
    if (closed || (ws && ws.readyState <= WebSocket.OPEN)) return
    handlers.onStatus?.('connecting')
    const socket = new WebSocket(roomSocketUrl(code, role))
    ws = socket

    socket.onopen = () => {
      attempt = 0
      // Keeps proxies and NATs from dropping idle connections. The Worker answers "ping"
      // itself, without waking the room.
      pingTimer = setInterval(() => socket.send('ping'), PING_INTERVAL_MS)
      handlers.onStatus?.('open')
      handlers.onOpen?.()
    }
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data === 'pong') return
      try {
        handlers.onMessage(JSON.parse(event.data) as In)
      } catch {
        // Ignore malformed messages.
      }
    }
    socket.onclose = (event) => {
      clearInterval(pingTimer)
      if (ws === socket) ws = null
      if (closed) return
      if (event.code === CLOSE_UNKNOWN_ROOM || event.code === CLOSE_REPLACED) {
        closed = true
        handlers.onFatal?.(event.code === CLOSE_UNKNOWN_ROOM ? 'unknown-room' : 'replaced')
        return
      }
      handlers.onStatus?.('connecting')
      retryTimer = setTimeout(connect, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++))
    }
  }

  function reconnectNow() {
    if (document.visibilityState === 'visible' && !ws) {
      attempt = 0
      connect()
    }
  }

  document.addEventListener('visibilitychange', reconnectNow)
  window.addEventListener('online', reconnectNow)
  connect()

  return {
    send(message) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
    },
    close() {
      closed = true
      clearTimeout(retryTimer)
      clearInterval(pingTimer)
      document.removeEventListener('visibilitychange', reconnectNow)
      window.removeEventListener('online', reconnectNow)
      ws?.close(1000)
      ws = null
    },
  }
}

/** Asks the Worker for a pairing code, reusing `reclaim` if it's free. */
export async function createRoom(reclaim?: string | null): Promise<string> {
  const res = await fetch(`${config.workerUrl}/v1/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reclaim: reclaim ?? undefined }),
  })
  if (!res.ok) throw new Error(`Couldn't create a pairing code (${res.status}).`)
  return ((await res.json()) as { code: string }).code
}

/** Mirrors normalizeCode in worker/src/codes.ts. */
export function normalizeCode(input: string): string | null {
  const code = input.trim().toUpperCase()
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code) ? code : null
}
