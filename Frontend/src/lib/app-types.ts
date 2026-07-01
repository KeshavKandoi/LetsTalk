export type AppSession = {
  session: {
    expiresAt: string | Date
  }
  user: {
    id: string
    name: string
    username?: string | null
    displayUsername?: string | null
  }
}

export type PresenceStatus =
  | 'offline'
  | 'present'
  | 'ready'
  | 'in_conversation'

export type UserProfileState = {
  userId: string
  moodEmoji: string | null
  intentText: string | null
  intentSummary: string | null
  status: PresenceStatus
  currentPlaceId: string | null
  isFindable: boolean
  isVerifiedOnSite?: boolean
  locationHint: string | null
  pingRequestedAt: string | Date | null
  pingRequestedByUserId: string | null
  pingRequestedByUsername: string | null
  createdAt: string | Date
  updatedAt: string | Date
  age?: string | null
  gender?: string | null
  photoUrl?: string | null
  about?: string | null
}

export type UserAgentState = {
  userId: string
  username: string | null
  moodEmoji: string | null
  intentSummary: string | null
  status: PresenceStatus
  currentPlaceId: string | null
  isFindable: boolean
  isVerifiedOnSite?: boolean
  locationHint: string | null
  pingRequestedAt: string | null
  pingRequestedByUserId: string | null
  pingRequestedByUsername: string | null
  activeConversationId: string | null
  updatedAt: string | null
}

export type NearbyPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  latitude?: number | null
  longitude?: number | null
  readyCount: number
}

export type AppState = {
  session: AppSession | null
  profile: UserProfileState | null
  currentPlace: CurrentPlaceState | null
  qrHandoff: QrHandoffState | null
  activeConnection: ActiveConnectionState | null
}

export type CurrentPlaceState = {
  place: NearbyPlace
  readyCount: number
}

export type NearbyPlacePreviewState = {
  placeId: string
  readyCount: number
  checkedInCount: number
  activeConversationCount: number
  participants: PlaceAgentParticipantState[]
  pendingConnectionRequests?: PendingConnectionRequestState[]
  activeConnection?: ActiveConnectionState | null
  connectionEvents?: ConnectionEventState[]
}

export type PlaceAgentState = {
  placeId: string
  readyCount: number
  checkedInCount: number
  participants: PlaceAgentParticipantState[]
  connections: PlaceAgentConnectionState[]
  updatedAt: string | null
}

export type PlaceAgentParticipantState = {
  userId: string
  username: string
  moodEmoji: string | null
  intentText?: string | null
  intentSummary: string | null
  status: PresenceStatus
  isFindable: boolean
  isVerifiedOnSite?: boolean
  locationHint: string | null
  age?: string | null
  gender?: string | null
  photoUrl?: string | null
  about?: string | null
  pingRequestedAt: string | Date | null
  pingRequestedByUserId: string | null
  pingRequestedByUsername: string | null
}

export type PlaceAgentConnectionState = {
  id: string
  requesterUserId: string
  recipientUserId: string
  createdAt: string | Date
}

export type QrHandoffState = {
  token: string
  url: string
  expiresAt: string | Date
  isActive: boolean
}

export type ConnectionPreviewState = {
  token: string
  placeId: string
  placeName: string
  counterpart: {
    userId: string
    username: string
    moodEmoji: string | null
    intentSummary: string | null
    status: PresenceStatus
  }
}

export type ActiveConnectionState = {
  id: string
  placeId: string
  createdAt: string | Date
  qrVerifiedAt?: string | Date | null
  counterpart: {
    userId: string
    username: string
    moodEmoji: string | null
    intentSummary: string | null
    spotLabel?: string | null
    locationHint?: string | null
    photoUrl?: string | null
  }
}

export type PendingConnectionRequestState = {
  id: string
  requesterUserId: string
  recipientUserId: string
  placeId: string
  status: string
  direction: 'incoming' | 'outgoing'
  createdAt: string | Date
  updatedAt: string | Date
  user: {
    userId: string
    username: string
    moodEmoji: string | null
    intentSummary: string | null
    photoUrl: string | null
  }
}

export type ConnectionEventState = {
  id: string
  status: string
  direction: 'incoming' | 'outgoing'
  updatedAt: string | Date
  message?: string
  user: {
    userId: string
    username: string
  }
}
