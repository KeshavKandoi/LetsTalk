import { chatSubject, ensureChatRelay, publishChatEvent, type ChatNatsEvent } from './nats-service'
import { publishUserEvent } from './realtime-publish'

const PUBLISH_TIMEOUT_MS = 3000

async function deliverToClient(event: ChatNatsEvent) {
  return publishUserEvent(event.recipientUserId, 'new_message', event.message)
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms: number) {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      () => { clearTimeout(timer); resolve(fallback) },
    )
  })
}

export async function relayPersistedMessage(input: {
  message: Record<string, unknown>
  messageId: string
  friendRequestId: string
  senderUserId: string
  recipientUserId: string
  messageType: string
  createdAt: string
}): Promise<boolean> {
  console.log(`[CHAT_NATS] db insert completed messageId=${input.messageId} conversationId=${input.friendRequestId} sender=${input.senderUserId} recipient=${input.recipientUserId}`)
  try {
    chatSubject(input.recipientUserId)
    const ready = await withTimeout(ensureChatRelay(deliverToClient), false, PUBLISH_TIMEOUT_MS)
    if (!ready) console.error(`[CHAT_NATS] relay not ready messageId=${input.messageId}`)
    const event: ChatNatsEvent = {
      v: 1,
      messageId: input.messageId,
      friendRequestId: input.friendRequestId,
      senderUserId: input.senderUserId,
      recipientUserId: input.recipientUserId,
      messageType: input.messageType,
      createdAt: input.createdAt,
      message: input.message,
    }
    return await withTimeout(publishChatEvent(event), false, PUBLISH_TIMEOUT_MS)
  } catch (error) {
    console.error(`[CHAT_NATS] relay failed messageId=${input.messageId} error=${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}
