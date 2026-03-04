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
  createdAt: string | Date
  updatedAt: string | Date
}

export type NearbyPlace = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
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
  intentSummary: string | null
  status: PresenceStatus
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
  counterpart: {
    userId: string
    username: string
    moodEmoji: string | null
    intentSummary: string | null
  }
}
