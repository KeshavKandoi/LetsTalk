import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
    username: text('username'),
    displayUsername: text('displayUsername'),
  },
  (table) => [
    uniqueIndex('user_email_unique').on(table.email),
    uniqueIndex('user_username_unique').on(table.username),
  ],
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt').notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('session_token_unique').on(table.token),
    index('session_userId_idx').on(table.userId),
  ],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
  },
  (table) => [
    index('account_userId_idx').on(table.userId),
    uniqueIndex('account_provider_account_unique').on(
      table.providerId,
      table.accountId,
    ),
  ],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const userProfile = pgTable('user_profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  moodEmoji: text('mood_emoji'),
  intentText: text('intent_text'),
  about: text('about'),
  intentSummary: text('intent_summary'),
  status: text('status').notNull().default('offline'),
  currentPlaceId: text('current_place_id'),
  isFindable: boolean('is_findable').notNull().default(false),
  locationHint: text('location_hint'),
  pingRequestedAt: timestamp('ping_requested_at'),
  pingRequestedByUserId: text('ping_requested_by_user_id'),
  pingRequestedByUsername: text('ping_requested_by_username'),
  pushToken: text('push_token'),
  photoUrl: text('photo_url'),
  age: text('age'),
  gender: text('gender'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const place = pgTable('place', {
  placeId: text('place_id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const handoffCode = pgTable(
  'handoff_code',
  {
    token: text('token').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    placeId: text('place_id')
      .notNull()
      .references(() => place.placeId, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('handoff_code_user_unique').on(table.userId),
    index('handoff_code_place_idx').on(table.placeId),
  ],
)

export const handoffConnection = pgTable(
  'handoff_connection',
  {
    id: text('id').primaryKey(),
    requesterUserId: text('requester_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipientUserId: text('recipient_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    placeId: text('place_id')
      .notNull()
      .references(() => place.placeId, { onDelete: 'cascade' }),
    status: text('status').notNull().default('accepted'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('handoff_connection_requester_idx').on(table.requesterUserId),
    index('handoff_connection_recipient_idx').on(table.recipientUserId),
    index('handoff_connection_place_idx').on(table.placeId),
  ],
)

export const friendRequest = pgTable(
  'friend_request',
  {
    id: text('id').primaryKey(),
    requesterUserId: text('requester_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipientUserId: text('recipient_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    placeId: text('place_id').references(() => place.placeId, {
      onDelete: 'set null',
    }),
    initiatorUserId: text('initiator_user_id'),
    requesterAccepted: boolean('requester_accepted').notNull().default(false),
    recipientAccepted: boolean('recipient_accepted').notNull().default(false),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('friend_request_requester_idx').on(table.requesterUserId),
    index('friend_request_recipient_idx').on(table.recipientUserId),
    uniqueIndex('friend_request_pair_unique').on(
      table.requesterUserId,
      table.recipientUserId,
    ),
  ],
)

export const friendMessage = pgTable(
  'friend_message',
  {
    id: text('id').primaryKey(),
    friendRequestId: text('friend_request_id')
      .notNull()
      .references(() => friendRequest.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipientUserId: text('recipient_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    status: text('status').notNull().default('pending'),
    sentAt: timestamp('sent_at'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('friend_message_request_idx').on(table.friendRequestId),
    index('friend_message_sender_idx').on(table.senderUserId),
    index('friend_message_recipient_idx').on(table.recipientUserId),
  ],
)


export const userActivity = pgTable(
  'user_activity',
  {
    userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
    isOnline: boolean('is_online').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
)

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  profile: one(userProfile),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, { fields: [userProfile.userId], references: [user.id] }),
}))
