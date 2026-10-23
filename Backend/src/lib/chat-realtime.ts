import { publishUserEvent } from './realtime-publish'

export async function relayPersistedMessage(input: {
  message: Record<string, unknown>
  messageId: string
  friendRequestId: string
  senderUserId: string
  recipientUserId: string
  messageType: string
  createdAt: string
}): Promise<boolean> {
  return publishUserEvent(input.recipientUserId, 'new_message', input.message)
}
