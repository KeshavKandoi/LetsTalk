import type { PresenceStatus } from '../../app-types'

type UserProfileSnapshot = {
  status: PresenceStatus
  currentPlaceId: string | null
}

type ValidateConnectionInput = {
  viewerProfile: UserProfileSnapshot | null | undefined
  targetProfile: UserProfileSnapshot | null | undefined
  placeId: string
  viewerHasActiveConnection: boolean
  targetHasActiveConnection: boolean
}

export function normalizeIntentText(intentText: string) {
  return intentText.replace(/\s+/g, ' ').trim() || null
}

export function buildIntentSummary(intentText: string | null) {
  if (!intentText) {
    return 'Open to a nearby conversation.'
  }

  if (intentText.length <= 72) {
    return intentText
  }

  return `${intentText.slice(0, 69).trimEnd()}...`
}

export function assertCanSetReady(
  profile: UserProfileSnapshot | null | undefined,
) {
  if (!profile?.currentPlaceId) {
    throw new Error('Pick your current place before changing your status.')
  }

  if (profile.status === 'in_conversation') {
    throw new Error('End your current conversation before changing your status.')
  }
}

export function assertCanConnectAtPlace(input: ValidateConnectionInput) {
  const {
    viewerProfile,
    targetProfile,
    placeId,
    viewerHasActiveConnection,
    targetHasActiveConnection,
  } = input

  if (!viewerProfile?.currentPlaceId || viewerProfile.currentPlaceId !== placeId) {
    throw new Error('You need to be checked into the same place first.')
  }

  if (viewerProfile.status === 'in_conversation') {
    throw new Error('End your current conversation before starting another one.')
  }

  if (!targetProfile?.currentPlaceId || targetProfile.currentPlaceId !== placeId) {
    throw new Error('They are no longer checked into this place.')
  }

  if (targetProfile.status !== 'ready') {
    throw new Error('They are not marked ready right now.')
  }

  if (viewerHasActiveConnection) {
    throw new Error('You are already connected with someone nearby.')
  }

  if (targetHasActiveConnection) {
    throw new Error('They are already in a conversation.')
  }
}

export function buildConversationIntentSummary(
  intentSummary: string | null,
  intentText: string | null,
) {
  return intentSummary ?? buildIntentSummary(intentText)
}
