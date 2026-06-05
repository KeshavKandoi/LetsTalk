import { pgTable, uniqueIndex, index, foreignKey, text, timestamp, boolean, real } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ mode: 'string' }),
	refreshTokenExpiresAt: timestamp({ mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("account_provider_account_unique").using("btree", table.providerId.asc().nullsLast().op("text_ops"), table.accountId.asc().nullsLast().op("text_ops")),
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_userId_user_id_fk"
		}).onDelete("cascade"),
]);

export const handoffCode = pgTable("handoff_code", {
	token: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	placeId: text("place_id").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("handoff_code_place_idx").using("btree", table.placeId.asc().nullsLast().op("text_ops")),
	uniqueIndex("handoff_code_user_unique").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.placeId],
			foreignColumns: [place.placeId],
			name: "handoff_code_place_id_place_place_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "handoff_code_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull(),
}, (table) => [
	uniqueIndex("session_token_unique").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_userId_user_id_fk"
		}).onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);

export const userProfile = pgTable("user_profile", {
	userId: text("user_id").primaryKey().notNull(),
	moodEmoji: text("mood_emoji"),
	intentText: text("intent_text"),
	intentSummary: text("intent_summary"),
	status: text().default('offline').notNull(),
	currentPlaceId: text("current_place_id"),
	isFindable: boolean("is_findable").default(false).notNull(),
	locationHint: text("location_hint"),
	pingRequestedAt: timestamp("ping_requested_at", { mode: 'string' }),
	pingRequestedByUserId: text("ping_requested_by_user_id"),
	pingRequestedByUsername: text("ping_requested_by_username"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	pushToken: text("push_token"),
	photoUrl: text("photo_url"),
	age: text(),
	gender: text(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "user_profile_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean().default(false).notNull(),
	image: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }).notNull(),
	username: text(),
	displayUsername: text(),
}, (table) => [
	uniqueIndex("user_email_unique").using("btree", table.email.asc().nullsLast().op("text_ops")),
	uniqueIndex("user_username_unique").using("btree", table.username.asc().nullsLast().op("text_ops")),
]);

export const place = pgTable("place", {
	placeId: text("place_id").primaryKey().notNull(),
	name: text().notNull(),
	address: text().notNull(),
	lat: real().notNull(),
	lng: real().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
});

export const handoffConnection = pgTable("handoff_connection", {
	id: text().primaryKey().notNull(),
	requesterUserId: text("requester_user_id").notNull(),
	recipientUserId: text("recipient_user_id").notNull(),
	placeId: text("place_id").notNull(),
	status: text().default('accepted').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("handoff_connection_place_idx").using("btree", table.placeId.asc().nullsLast().op("text_ops")),
	index("handoff_connection_recipient_idx").using("btree", table.recipientUserId.asc().nullsLast().op("text_ops")),
	index("handoff_connection_requester_idx").using("btree", table.requesterUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.placeId],
			foreignColumns: [place.placeId],
			name: "handoff_connection_place_id_place_place_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.recipientUserId],
			foreignColumns: [user.id],
			name: "handoff_connection_recipient_user_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.requesterUserId],
			foreignColumns: [user.id],
			name: "handoff_connection_requester_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const friendRequest = pgTable("friend_request", {
	id: text().primaryKey().notNull(),
	requesterUserId: text("requester_user_id").notNull(),
	recipientUserId: text("recipient_user_id").notNull(),
	placeId: text("place_id"),
	requesterAccepted: boolean("requester_accepted").default(false).notNull(),
	recipientAccepted: boolean("recipient_accepted").default(false).notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	initiatorUserId: text("initiator_user_id"),
}, (table) => [
	uniqueIndex("friend_request_pair_unique").using("btree", table.requesterUserId.asc().nullsLast().op("text_ops"), table.recipientUserId.asc().nullsLast().op("text_ops")),
	index("friend_request_recipient_idx").using("btree", table.recipientUserId.asc().nullsLast().op("text_ops")),
	index("friend_request_requester_idx").using("btree", table.requesterUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.placeId],
			foreignColumns: [place.placeId],
			name: "friend_request_place_id_place_place_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.recipientUserId],
			foreignColumns: [user.id],
			name: "friend_request_recipient_user_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.requesterUserId],
			foreignColumns: [user.id],
			name: "friend_request_requester_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const friendMessage = pgTable("friend_message", {
	id: text().primaryKey().notNull(),
	friendRequestId: text("friend_request_id").notNull(),
	senderUserId: text("sender_user_id").notNull(),
	recipientUserId: text("recipient_user_id").notNull(),
	body: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("friend_message_recipient_idx").using("btree", table.recipientUserId.asc().nullsLast().op("text_ops")),
	index("friend_message_request_idx").using("btree", table.friendRequestId.asc().nullsLast().op("text_ops")),
	index("friend_message_sender_idx").using("btree", table.senderUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.friendRequestId],
			foreignColumns: [friendRequest.id],
			name: "friend_message_friend_request_id_friend_request_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.recipientUserId],
			foreignColumns: [user.id],
			name: "friend_message_recipient_user_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderUserId],
			foreignColumns: [user.id],
			name: "friend_message_sender_user_id_user_id_fk"
		}).onDelete("cascade"),
]);
