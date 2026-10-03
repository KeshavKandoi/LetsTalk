import { connect, type NatsConnection, type Subscription } from 'nats'

export type ChatNatsEvent = {
  v: 1
  messageId: string
  friendRequestId: string
  senderUserId: string
  recipientUserId: string
  messageType: string
  createdAt: string
  message: Record<string, unknown>
}

export type ChatDeliver = (event: ChatNatsEvent) => Promise<boolean>

const SUBJECT_PREFIX = 'chat.user.'
const RELAY_QUEUE = 'chat-relay'
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const SEEN_LIMIT = 500

let connectionPromise: Promise<NatsConnection> | null = null
let relaySub: Subscription | null = null
let relayStarting: Promise<void> | null = null
let shutdownRegistered = false
const seen = new Set<string>()

export function getNatsUrl() {
  const url = process.env.NATS_URL
  if (url) return url
  if (process.env.NODE_ENV === 'production') throw new Error('Missing NATS_URL in production')
  return 'nats://localhost:4222'
}

export function chatSubject(userId: string) {
  if (typeof userId !== 'string' || !USER_ID_PATTERN.test(userId)) throw new Error('Invalid user id for chat subject')
  return `${SUBJECT_PREFIX}${userId}`
}

export function parseChatEvent(raw: unknown): ChatNatsEvent | null {
  if (typeof raw !== 'object' || raw === null) return null
  const e = raw as Record<string, unknown>
  const message = e.message as Record<string, unknown> | null
  if (
    e.v !== 1 ||
    typeof e.messageId !== 'string' || !e.messageId ||
    typeof e.friendRequestId !== 'string' || !e.friendRequestId ||
    typeof e.senderUserId !== 'string' || !USER_ID_PATTERN.test(e.senderUserId) ||
    typeof e.recipientUserId !== 'string' || !USER_ID_PATTERN.test(e.recipientUserId) ||
    typeof e.messageType !== 'string' ||
    typeof e.createdAt !== 'string' ||
    typeof message !== 'object' || message === null ||
    message.id !== e.messageId
  ) {
    return null
  }
  return e as unknown as ChatNatsEvent
}

function registerShutdown() {
  if (shutdownRegistered) return
  shutdownRegistered = true
  const stop = () => { void closeNats() }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
}

function getConnection(): Promise<NatsConnection> {
  if (connectionPromise) return connectionPromise
  console.log('[CHAT_NATS] connection created')
  const created = connect({
    servers: getNatsUrl(),
    name: 'letstalk-backend',
    maxReconnectAttempts: -1,
    reconnectTimeWait: 1000,
    timeout: 5000,
  }).then((nc) => {
    console.log('[CHAT_NATS] connected')
    registerShutdown()
    void (async () => {
      for await (const status of nc.status()) console.log(`[CHAT_NATS] status=${status.type}`)
    })()
    void nc.closed().then((err) => {
      console.log(`[CHAT_NATS] connection closed${err ? ` error=${err.message}` : ''}`)
      if (connectionPromise === created) connectionPromise = null
      relaySub = null
      relayStarting = null
    })
    return nc
  })
  connectionPromise = created
  created.catch((err) => {
    console.error(`[CHAT_NATS] connect failed error=${err instanceof Error ? err.message : String(err)}`)
    if (connectionPromise === created) connectionPromise = null
  })
  return created
}

export async function publishChatEvent(event: ChatNatsEvent): Promise<boolean> {
  const ids = `messageId=${event.messageId} sender=${event.senderUserId} recipient=${event.recipientUserId}`
  try {
    const subject = chatSubject(event.recipientUserId)
    console.log(`[CHAT_NATS] publish started ${ids}`)
    const nc = await getConnection()
    nc.publish(subject, new TextEncoder().encode(JSON.stringify(event)))
    await nc.flush()
    console.log(`[CHAT_NATS] publish succeeded ${ids}`)
    return true
  } catch (error) {
    console.error(`[CHAT_NATS] publish failed ${ids} error=${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function runRelay(sub: Subscription, deliver: ChatDeliver) {
  for await (const msg of sub) {
    let event: ChatNatsEvent | null = null
    try {
      event = parseChatEvent(JSON.parse(new TextDecoder().decode(msg.data)))
    } catch {
      event = null
    }
    if (!event) {
      console.warn(`[CHAT_NATS] malformed event rejected subject=${msg.subject}`)
      continue
    }
    if (msg.subject !== chatSubject(event.recipientUserId)) {
      console.warn(`[CHAT_NATS] routing mismatch rejected messageId=${event.messageId}`)
      continue
    }
    if (seen.has(event.messageId)) {
      console.log(`[CHAT_NATS] duplicate event ignored messageId=${event.messageId}`)
      continue
    }
    seen.add(event.messageId)
    if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value as string)
    console.log(`[CHAT_NATS] event received messageId=${event.messageId} recipient=${event.recipientUserId}`)
    try {
      const delivered = await deliver(event)
      console.log(`[CHAT_NATS] client delivery messageId=${event.messageId} recipient=${event.recipientUserId} result=${delivered ? 'ok' : 'failed'}`)
    } catch (error) {
      console.error(`[CHAT_NATS] client delivery threw messageId=${event.messageId} error=${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log('[CHAT_NATS] subscription closed')
}

export async function ensureChatRelay(deliver: ChatDeliver): Promise<boolean> {
  if (relaySub && !relaySub.isClosed()) return true
  if (!relayStarting) {
    relayStarting = (async () => {
      const nc = await getConnection()
      const sub = nc.subscribe(`${SUBJECT_PREFIX}*`, { queue: RELAY_QUEUE })
      relaySub = sub
      console.log(`[CHAT_NATS] subscription created subject=${SUBJECT_PREFIX}* queue=${RELAY_QUEUE}`)
      void runRelay(sub, deliver)
    })().finally(() => { relayStarting = null })
  }
  try {
    await relayStarting
    return true
  } catch (error) {
    console.error(`[CHAT_NATS] subscription failed error=${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

export async function closeNats() {
  const pending = connectionPromise
  connectionPromise = null
  relaySub = null
  relayStarting = null
  if (!pending) return
  try {
    const nc = await pending
    await nc.drain()
    console.log('[CHAT_NATS] drained and closed')
  } catch (error) {
    console.error(`[CHAT_NATS] shutdown error=${error instanceof Error ? error.message : String(error)}`)
  }
}
