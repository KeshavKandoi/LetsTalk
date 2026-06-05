import { relations } from "drizzle-orm/relations";
import { user, account, place, handoffCode, session, userProfile, handoffConnection, friendRequest, friendMessage } from "./schema";

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	handoffCodes: many(handoffCode),
	sessions: many(session),
	userProfiles: many(userProfile),
	handoffConnections_recipientUserId: many(handoffConnection, {
		relationName: "handoffConnection_recipientUserId_user_id"
	}),
	handoffConnections_requesterUserId: many(handoffConnection, {
		relationName: "handoffConnection_requesterUserId_user_id"
	}),
	friendRequests_recipientUserId: many(friendRequest, {
		relationName: "friendRequest_recipientUserId_user_id"
	}),
	friendRequests_requesterUserId: many(friendRequest, {
		relationName: "friendRequest_requesterUserId_user_id"
	}),
	friendMessages_recipientUserId: many(friendMessage, {
		relationName: "friendMessage_recipientUserId_user_id"
	}),
	friendMessages_senderUserId: many(friendMessage, {
		relationName: "friendMessage_senderUserId_user_id"
	}),
}));

export const handoffCodeRelations = relations(handoffCode, ({one}) => ({
	place: one(place, {
		fields: [handoffCode.placeId],
		references: [place.placeId]
	}),
	user: one(user, {
		fields: [handoffCode.userId],
		references: [user.id]
	}),
}));

export const placeRelations = relations(place, ({many}) => ({
	handoffCodes: many(handoffCode),
	handoffConnections: many(handoffConnection),
	friendRequests: many(friendRequest),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userProfileRelations = relations(userProfile, ({one}) => ({
	user: one(user, {
		fields: [userProfile.userId],
		references: [user.id]
	}),
}));

export const handoffConnectionRelations = relations(handoffConnection, ({one}) => ({
	place: one(place, {
		fields: [handoffConnection.placeId],
		references: [place.placeId]
	}),
	user_recipientUserId: one(user, {
		fields: [handoffConnection.recipientUserId],
		references: [user.id],
		relationName: "handoffConnection_recipientUserId_user_id"
	}),
	user_requesterUserId: one(user, {
		fields: [handoffConnection.requesterUserId],
		references: [user.id],
		relationName: "handoffConnection_requesterUserId_user_id"
	}),
}));

export const friendRequestRelations = relations(friendRequest, ({one, many}) => ({
	place: one(place, {
		fields: [friendRequest.placeId],
		references: [place.placeId]
	}),
	user_recipientUserId: one(user, {
		fields: [friendRequest.recipientUserId],
		references: [user.id],
		relationName: "friendRequest_recipientUserId_user_id"
	}),
	user_requesterUserId: one(user, {
		fields: [friendRequest.requesterUserId],
		references: [user.id],
		relationName: "friendRequest_requesterUserId_user_id"
	}),
	friendMessages: many(friendMessage),
}));

export const friendMessageRelations = relations(friendMessage, ({one}) => ({
	friendRequest: one(friendRequest, {
		fields: [friendMessage.friendRequestId],
		references: [friendRequest.id]
	}),
	user_recipientUserId: one(user, {
		fields: [friendMessage.recipientUserId],
		references: [user.id],
		relationName: "friendMessage_recipientUserId_user_id"
	}),
	user_senderUserId: one(user, {
		fields: [friendMessage.senderUserId],
		references: [user.id],
		relationName: "friendMessage_senderUserId_user_id"
	}),
}));