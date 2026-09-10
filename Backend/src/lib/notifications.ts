import { and, eq } from 'drizzle-orm'
import { db } from './db'
import { notification, userProfile } from './db/schema'
import { sendPushNotification } from './push'

export type NotificationType = 'friend_request' | 'friend_accepted' | 'friend_removed' | 'scan_connected'

type CreateNotificationInput = {
  recipientUserId: string
  type: NotificationType
  message: string
  eventKey: string
  data?: Record<string, unknown>
  createdAt?: Date
}

export async function createNotification(input: CreateNotificationInput) {
  const createdAt = input.createdAt ?? new Date()
  const [created] = await db
    .insert(notification)
    .values({
      id: crypto.randomUUID(),
      recipientUserId: input.recipientUserId,
      type: input.type,
      message: input.message,
      data: input.data ? JSON.stringify(input.data) : null,
      eventKey: input.eventKey,
      createdAt,
      readAt: null,
    })
    .onConflictDoNothing({
      target: [notification.recipientUserId, notification.eventKey],
    })
    .returning({ id: notification.id })

  if (!created) return false

  void deliverPush(input.recipientUserId, input.message, input.type, created.id)
  return true
}

export async function createScanConnectionNotifications(input: {
  connectionId: string
  firstUser: { id: string; name: string }
  secondUser: { id: string; name: string }
  createdAt?: Date
}) {
  await Promise.all([
    createNotification({
      recipientUserId: input.firstUser.id,
      type: 'scan_connected',
      message: `You connected with ${input.secondUser.name}`,
      eventKey: `scan_connected:${input.connectionId}:${input.firstUser.id}`,
      data: { connectionId: input.connectionId, userId: input.secondUser.id },
      createdAt: input.createdAt,
    }),
    createNotification({
      recipientUserId: input.secondUser.id,
      type: 'scan_connected',
      message: `You connected with ${input.firstUser.name}`,
      eventKey: `scan_connected:${input.connectionId}:${input.secondUser.id}`,
      data: { connectionId: input.connectionId, userId: input.firstUser.id },
      createdAt: input.createdAt,
    }),
  ])
}

async function deliverPush(recipientUserId: string, message: string, type: NotificationType, notificationId: string) {
  const [profile] = await db
    .select({ pushToken: userProfile.pushToken })
    .from(userProfile)
    .where(eq(userProfile.userId, recipientUserId))
    .limit(1)

  if (!profile?.pushToken) return
  const delivered = await sendPushNotification(profile.pushToken, 'LetsTalk', message, { type, notificationId })
  if (!delivered) {
    await db
      .update(userProfile)
      .set({ pushToken: null })
      .where(and(eq(userProfile.userId, recipientUserId), eq(userProfile.pushToken, profile.pushToken)))
  }
}
