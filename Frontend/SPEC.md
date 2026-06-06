# LetsTalk Spec

## Overview

LetsTalk is a phone-first app for helping people connect with each other when they are physically in the same place and available to talk right now.

The MVP is intentionally narrow:

- the primary object is the person
- users are pseudonymous
- location permission is required
- place identity comes from Google Places
- users can browse nearby places
- users signal `ready` when they are available now
- starting a conversation requires scanning another user's QR code
- presence and live state are coordinated in real time

The product goal is to reduce the friction of starting in-person conversations without turning the app into a chat-first social network.

## Product Principles

- mobile-first and fast to understand
- calm, low-pressure, consent-forward UX
- same-place interaction only for MVP
- offline conversation is the real outcome, not in-app messaging
- show minimal information before a scan
- optimize for live presence and state accuracy

## MVP Scope

### In scope

- account creation and sign-in
- pseudonymous username
- onboarding with emoji mood and short intent text
- AI-generated intent summary from onboarding text
- required location permission
- browsing nearby places from current location
- current place resolution via Google Places
- live place presence
- ready/not ready/in conversation state
- static personal QR code
- scanning a QR code to start or join a conversation
- small-group conversation sessions at one place
- count of ready people at the current place

### Out of scope

- direct messaging
- browsing people without scanning
- detailed moderation systems beyond future placeholders
- custom user-created places in MVP
- matching across different places
- rich profiles, photos, and biographies
- push notifications

## Core User Experience

### Onboarding

1. User creates an account.
2. User chooses a pseudonymous username.
3. User chooses a mood emoji.
4. User optionally writes what they want to talk about.
5. The system generates an `intent_summary` from that text.
6. User grants location access.
7. The app resolves the user's current Google `place_id`.

If location permission is denied, the user cannot use the app.

### Nearby places flow

1. User grants location access.
2. The app fetches nearby Google Places for the current location.
3. The user can browse nearby places.
4. The user selects a place to enter its place view.
5. The app uses the selected Google `place_id` as the current working place context.

### Ready flow

1. User arrives at a recognized place.
2. App resolves the current `place_id` or the user selects a nearby place.
3. User enters the place view for that `place_id`.
4. User sets status to `ready`.
5. The place view shows the current count of ready people.
6. The user can display their static QR code for others to scan.

### Start conversation flow

1. User A is `ready` at place `P`.
2. User B is present at place `P`.
3. User B scans User A's QR code.
4. The app verifies both users are currently in the same `place_id`.
5. The app creates or reuses an active `ConversationSession`.
6. User B is promoted directly into the conversation flow even if they were not manually `ready` before scanning.
7. User A and User B move to `in_conversation`.
8. If User B was counted in the ready pool before the scan, remove them from it.
9. If User A was counted in the ready pool before the scan, remove them from it.
10. The conversation becomes visible as an active conversation at the place.

### Join conversation flow

1. User C is present at the same place.
2. User C scans the QR code of a participant already in an active conversation.
3. If the conversation is joinable and not full, User C joins that same `ConversationSession`.
4. User C moves directly to `in_conversation` even if they were not manually `ready` before scanning.

## Core Domain Model

### User

The person is the primary domain object.

Fields:

- `id`
- `username`
- `mood_emoji`
- `intent_text`
- `intent_summary`
- `status`
- `current_place_id`
- `last_location_at`
- `created_at`
- `updated_at`

Notes:

- usernames are pseudonymous
- mood is emoji-only in MVP
- `intent_summary` is generated at onboarding and can remain static for MVP

### Place

Represents a Google Place currently being used by the app.

Fields:

- `place_id`
- `name`
- `address`
- `lat`
- `lng`
- `created_at`
- `updated_at`

Notes:

- Google Places is the source of truth for MVP
- future manual correction or user-created places can be added later

### ConversationSession

Represents one live, in-progress conversation happening at a specific place.

Fields:

- `id`
- `place_id`
- `participant_user_ids`
- `status`
- `joinable`
- `max_participants`
- `created_at`
- `ended_at`

Notes:

- this is a real domain object, not just a boolean on a user
- it allows multiple participants
- it supports join/leave/end lifecycle

## State Model

### User status

Users can be in exactly one of these states:

- `offline`
- `present`
- `ready`
- `in_conversation`

Rules:

- `present` means the user is at a current `place_id` but not in the ready pool
- a user can only be `ready` if they have a current `place_id`
- a user can only be in one active conversation at a time
- scanning someone successfully can promote the scanner directly from `present` into `in_conversation`
- scanning someone successfully moves the scanned user into `in_conversation` when they are an eligible target
- users in `present` are visible only as presence, not part of the ready count
- users in `in_conversation` are not counted in the ready pool

### Conversation status

- `active`
- `ended`

Rules:

- an active conversation belongs to exactly one `place_id`
- only users at the same `place_id` can join
- conversations may be marked `joinable = false`
- ended conversations cannot be joined

## Real-Time Architecture

### UserAgent

Each user has a `UserAgent`.

Responsibilities:

- store the user's live state
- sync profile and status changes across devices/views
- own QR identity resolution
- track the user's current place membership
- coordinate handoff to the relevant `PlaceAgent`

Live state owned by `UserAgent`:

- `username`
- `mood_emoji`
- `intent_summary`
- `status`
- `current_place_id`
- `active_conversation_id`

### PlaceAgent

Each place has a `PlaceAgent`.

Responsibilities:

- maintain the set of users currently present at that place
- maintain the ready pool count
- maintain active conversation sessions at that place
- validate same-place scan rules
- create and update `ConversationSession` objects
- broadcast place-level changes to connected clients

Live state owned by `PlaceAgent`:

- `place_id`
- `present_user_ids`
- `ready_user_ids`
- `active_conversations`
- `last_updated_at`

### Why this split

- `UserAgent` is person-centric and follows the core product model
- `PlaceAgent` is required for same-place coordination and real-time shared state
- `ConversationSession` is managed by `PlaceAgent` for MVP rather than becoming its own separate agent

## Persistence Model

Use D1 for durable relational records and agent-managed live coordination state.

### Recommended relational tables

#### `user_profile`

- `user_id`
- `username`
- `mood_emoji`
- `intent_text`
- `intent_summary`
- `created_at`
- `updated_at`

#### `place`

- `place_id`
- `name`
- `address`
- `lat`
- `lng`
- `created_at`
- `updated_at`

#### `presence_session`

- `id`
- `user_id`
- `place_id`
- `started_at`
- `ended_at`
- `end_reason`

Purpose:

- record when a user was present at a place
- support analytics like time spent

#### `conversation_session`

- `id`
- `place_id`
- `status`
- `joinable`
- `max_participants`
- `started_at`
- `ended_at`

#### `conversation_participant`

- `conversation_id`
- `user_id`
- `joined_at`
- `left_at`

Purpose:

- track who joined which conversation and when

#### `qr_identity`

- `user_id`
- `qr_token`
- `created_at`

Purpose:

- map a scanned static QR to a user identity

## Location Rules

- location permission is mandatory
- the app resolves one Google `place_id` at a time
- nearby places can be browsed from the user's current location
- same-place logic is based on exact `place_id`
- the app refreshes location roughly once per minute in MVP
- if location becomes stale for multiple refresh cycles, mark the user `offline` or remove them from the place

## QR Rules

- each user has one static QR code in MVP
- QR codes identify a user profile, not a place or a temporary session
- scanning only succeeds if both users are currently in the same `place_id`
- scanning does not require the scanner to have manually set `ready` first
- scanning a user in an active, joinable conversation attempts to join that conversation
- scanning a user who is neither `ready` nor in a joinable conversation should fail with a simple message

## Conversation Rules

Recommended MVP rules:

- a user may be in only one active conversation at a time
- a conversation belongs to one place only
- a conversation starts when a present user scans a ready user in the same place
- a conversation may be joined by scanning any current participant's QR
- conversations should have a max participant cap

Recommended cap:

- `max_participants = 4`

Recommended end behavior:

- conversation ends when all participants leave
- a participant can leave manually
- leaving a conversation returns the user to `present` if they are still at the same place
- re-entering the ready pool should require an explicit user action

## Place View

The MVP place view should show:

- current place name
- current ready count
- nearby places entry point
- user's current state
- button to toggle `ready`
- button to show personal QR code
- active conversation status if the user is in one

The MVP place view should not show:

- a browsable list of nearby strangers
- detailed profile cards for everyone at the place

## AI Behavior

AI in MVP is narrow and supportive.

### In scope

- summarize onboarding intent text into a short `intent_summary`
- keep this summary available to the app and agents as a stable piece of state

### Out of scope

- autonomous matching
- ongoing conversational coaching
- proactive notifications
- dynamic profile rewriting during MVP

Notes:

- the AI summary should be editable later, but it does not need to be editable in MVP
- the agent layer is used primarily for state coordination, not heavy autonomous behavior in MVP
- Cloudflare Agents should be treated as the product/runtime abstraction; lower-level storage/runtime details are implementation details

## APIs and Events

Exact route names can change, but the system needs these capabilities.

### App/API capabilities

- create account
- sign in
- complete onboarding
- fetch nearby places
- resolve current place from location
- select a place from nearby results
- fetch current place state
- generate or fetch personal QR payload
- resolve scanned QR payload to a user

### UserAgent actions

- `setProfile`
- `setMood`
- `setIntentSummary`
- `joinPlace`
- `leavePlace`
- `setReady`
- `setOffline`
- `enterConversation`
- `leaveConversation`

### PlaceAgent actions

- `userArrived`
- `userDeparted`
- `setUserReady`
- `setUserNotReady`
- `startConversation`
- `joinConversation`
- `leaveConversation`
- `endConversation`
- `getPlaceSnapshot`

## Failure Cases

The app must handle these clearly:

- location permission denied
- no resolvable Google Place found
- scan target is at a different place
- scan target is not ready
- scan target has left
- conversation is full
- conversation is no longer joinable
- stale presence state

Recommended UX:

- short, direct failure copy
- no ambiguous partial state
- always show the user's current actual state after failure

## Metrics

Primary success metric:

- time spent in the app

Supporting metrics:

- time spent `ready`
- number of ready sessions started
- number of scans attempted
- number of successful conversation starts
- average conversation duration
- average participants per conversation

## Security and Privacy

MVP posture:

- pseudonymous usernames only
- no public browsing of all users
- same-place requirement for scans
- minimal visible data before connection

Known future work:

- block/report flows
- rotating QR codes
- abuse prevention and rate limits
- moderation and venue-level controls

## Technical Fit With Current Repo

The current repository already includes:

- TanStack Start
- React + TypeScript
- Cloudflare Worker deployment via Wrangler
- D1 via Drizzle
- Better Auth

This spec assumes those remain the foundation.
Use the Cloudflare Agents SDK for agent behavior and state sync. The fact that Agents may be implemented on top of Durable Objects should be treated as an implementation detail, not a product or domain concept.

## Suggested Delivery Order

### Phase 1

- finish auth and onboarding
- add `user_profile` fields for mood and intent
- integrate required location permission
- fetch and browse nearby Google Places
- resolve current Google `place_id`

### Phase 2

- implement `UserAgent`
- implement `PlaceAgent`
- join/leave place presence
- place view with ready count

### Phase 3

- generate static QR identity
- scan flow
- start conversation
- join conversation

### Phase 4

- conversation lifecycle cleanup
- stale presence cleanup
- analytics for time spent and conversation duration

## Explicit MVP Decisions

- person is the primary object
- QR identifies a user profile
- the app connects people already in the same place
- browsing nearby places is part of MVP
- `ready` means available now
- location denial means the app is unusable
- Google Places is the place source of truth for MVP
- conversation discovery starts with count only
- QR is required to start a conversation
- scanning can promote the scanner directly into a conversation without a manual ready step
- mood is emoji-only
- QR is static in MVP
- `UserAgent` handles identity and user state
- `PlaceAgent` handles place coordination and conversation state

## Open Questions For Later

- should users who leave a conversation be prompted to re-enter the ready pool immediately
- should a place show active conversation count in addition to ready count
- should mood and intent ever be visible pre-scan
- should there be a hidden override when Google Places is wrong
- what exact copy should explain why location permission is mandatory
