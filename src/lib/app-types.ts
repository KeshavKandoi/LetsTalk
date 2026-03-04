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
}

export type AppState = {
  session: AppSession | null
  profile: UserProfileState | null
  currentPlace: CurrentPlaceState | null
}

export type CurrentPlaceState = {
  place: NearbyPlace
  readyCount: number
}

export type PlaceAgentState = {
  placeId: string
  readyCount: number
  checkedInCount: number
  updatedAt: string | null
}
