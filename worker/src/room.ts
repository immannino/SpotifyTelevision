// One Durable Object per pairing code. It relays messages between the TV and any phones
// ("remotes") in the room, and doesn't interpret them beyond two details:
//  - The latest message of a "sticky" type from each side is kept and replayed (marked
//    `replay: true`) to anyone who (re)connects, so a phone waking up immediately learns
//    what the TV is doing.
//  - Presence ({ type: 'presence', tv, remotes }) is broadcast whenever someone joins or leaves.
//
// Sockets use the Hibernation API, so an idle room costs nothing between messages.
import { DurableObject } from 'cloudflare:workers'

export type Role = 'tv' | 'remote'

/** Message types worth replaying on connect, by the role that sends them. */
const STICKY: Record<Role, string> = { tv: 'status', remote: 'queue' }
/** Rooms with no connections for this long are wiped and their code can be reused. */
const IDLE_TTL_MS = 12 * 60 * 60 * 1000
const MAX_MESSAGE_BYTES = 64 * 1024

export const CLOSE_UNKNOWN_ROOM = 4404
export const CLOSE_REPLACED = 4000

export class Room extends DurableObject<unknown> {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env)
    // Answered by the runtime without waking the object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  /** Reserves this room for a TV. Fails if another TV is currently connected to it. */
  async claim(): Promise<boolean> {
    if (this.ctx.getWebSockets('tv').length > 0) return false
    await this.ctx.storage.put('claimed', true)
    await this.touch()
    return true
  }

  async fetch(request: Request): Promise<Response> {
    const role = new URL(request.url).searchParams.get('role')
    if (role !== 'tv' && role !== 'remote') return new Response('role must be tv or remote', { status: 400 })

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]

    // Reported over the socket, since browsers hide HTTP errors on a failed upgrade. Uses a
    // plain (non-hibernating) socket: closing a hibernatable one before the upgrade response
    // is returned leaves the close handshake hanging.
    if (!(await this.ctx.storage.get<boolean>('claimed'))) {
      server.accept()
      server.close(CLOSE_UNKNOWN_ROOM, 'No TV is using that code')
      return new Response(null, { status: 101, webSocket: client })
    }

    this.ctx.acceptWebSocket(server, [role])

    if (role === 'tv') {
      for (const old of this.ctx.getWebSockets('tv')) {
        if (old !== server) old.close(CLOSE_REPLACED, 'Another TV took over this code')
      }
    }

    const other: Role = role === 'tv' ? 'remote' : 'tv'
    const sticky = await this.ctx.storage.get<string>(`sticky:${other}`)
    // Marked so receivers can tell old state from a fresh message (a TV following Spotify
    // ignores a replayed queue, but a new one means a phone is taking over).
    if (sticky) server.send(JSON.stringify({ ...(JSON.parse(sticky) as object), replay: true }))

    this.broadcastPresence()
    await this.touch()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) return
    let type: unknown
    try {
      type = (JSON.parse(message) as { type?: unknown }).type
    } catch {
      return
    }
    const role = this.roleOf(ws)
    if (!role || typeof type !== 'string') return

    if (STICKY[role] === type) await this.ctx.storage.put(`sticky:${role}`, message)
    for (const peer of this.ctx.getWebSockets(role === 'tv' ? 'remote' : 'tv')) peer.send(message)
    await this.touch()
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    // The runtime requires completing the close handshake ourselves.
    try {
      ws.close(code === 1005 ? 1000 : code)
    } catch {
      // Already closed.
    }
    this.broadcastPresence(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcastPresence(ws)
  }

  async alarm(): Promise<void> {
    const lastActive = (await this.ctx.storage.get<number>('lastActive')) ?? 0
    if (this.ctx.getWebSockets().length === 0 && Date.now() - lastActive >= IDLE_TTL_MS) {
      await this.ctx.storage.deleteAll()
      return
    }
    await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS)
  }

  private async touch() {
    await this.ctx.storage.put('lastActive', Date.now())
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS)
  }

  private roleOf(ws: WebSocket): Role | null {
    const [tag] = this.ctx.getTags(ws)
    return tag === 'tv' || tag === 'remote' ? tag : null
  }

  private broadcastPresence(leaving?: WebSocket) {
    const open = (role: Role) => this.ctx.getWebSockets(role).filter((ws) => ws !== leaving && ws.readyState === WebSocket.OPEN)
    const message = JSON.stringify({ type: 'presence', tv: open('tv').length > 0, remotes: open('remote').length })
    for (const ws of [...open('tv'), ...open('remote')]) ws.send(message)
  }
}
