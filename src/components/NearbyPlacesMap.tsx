import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, MapPinned } from 'lucide-react'
import type { NearbyPlace } from '../lib/app-types'
import {
  getLoadedGoogleMapsApiKey,
  loadGoogleMapsApi,
} from '../lib/google-maps-client'

type MapLike = {
  fitBounds: (bounds: BoundsLike, padding?: number) => void
  setCenter: (position: { lat: number; lng: number }) => void
  setZoom: (zoom: number) => void
}

type MarkerLike = {
  addEventListener?: (eventName: string, handler: () => void) => void
  addListener?: (eventName: string, handler: () => void) => void
  map?: MapLike | null
  setMap?: (map: MapLike | null) => void
}

type BoundsLike = {
  extend: (position: { lat: number; lng: number }) => void
}

export function NearbyPlacesMap({
  places,
  selectedPlaceId,
  locationCoords,
  onSelectPlace,
  googleMapsConfig,
}: {
  places: NearbyPlace[]
  selectedPlaceId: string | null
  locationCoords: {
    latitude: number
    longitude: number
  } | null
  onSelectPlace: (placeId: string) => void
  googleMapsConfig: {
    apiKey: string
    mapId: string | null
  } | null
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLike | null>(null)
  const markerRefs = useRef<MarkerLike[]>([])
  const locationMarkerRef = useRef<MarkerLike | null>(null)
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(
    getLoadedGoogleMapsApiKey(),
  )
  const [loadingState, setLoadingState] = useState<
    'idle' | 'config-loading' | 'script-loading' | 'ready'
  >(mapsApiKey ? 'script-loading' : 'idle')
  const [loadError, setLoadError] = useState<string | null>(null)

  const googleMapsApiKey = googleMapsConfig?.apiKey ?? null
  const googleMapsMapId = googleMapsConfig?.mapId ?? null

  useEffect(() => {
    if (mapsApiKey || !googleMapsApiKey) {
      return
    }

    setLoadError(null)
    setMapsApiKey(googleMapsApiKey)
    setLoadingState('script-loading')
  }, [googleMapsApiKey, mapsApiKey])

  useEffect(() => {
    if (places.length === 0) {
      return
    }

    if (!googleMapsApiKey && !mapsApiKey) {
      setLoadError('Missing Google Maps browser key.')
      setLoadingState('idle')
      return
    }

    if (!mapsApiKey || !mapElementRef.current) {
      return
    }

    let disposed = false
    setLoadingState('script-loading')

    void loadGoogleMapsApi(mapsApiKey, {
      loadMarkerLibrary: Boolean(googleMapsMapId),
    })
      .then((maps) => {
        if (disposed || !mapElementRef.current) {
          return
        }

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapElementRef.current, {
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: 'greedy',
            ...(googleMapsMapId ? { mapId: googleMapsMapId } : {}),
            zoomControl: true,
            styles: [
              {
                featureType: 'poi',
                stylers: [{ visibility: 'off' }],
              },
            ],
          })
        }

        markerRefs.current.forEach((marker) => {
          marker.setMap?.(null)
        })
        markerRefs.current = []

        if (locationMarkerRef.current) {
          locationMarkerRef.current.setMap?.(null)
          locationMarkerRef.current = null
        }

        const bounds = new maps.LatLngBounds()
        const useAdvancedMarkers = Boolean(
          googleMapsMapId && maps.AdvancedMarkerElement,
        )

        for (const place of places) {
          const isSelected = place.placeId === selectedPlaceId
          const marker = useAdvancedMarkers
            ? new maps.AdvancedMarkerElement!({
                content: buildPlaceMarkerNode({
                  isSelected,
                  readyCount: place.readyCount,
                }),
                gmpClickable: true,
                map: mapRef.current,
                position: {
                  lat: place.lat,
                  lng: place.lng,
                },
                title: place.name,
              })
            : new maps.Marker({
                map: mapRef.current,
                position: {
                  lat: place.lat,
                  lng: place.lng,
                },
                title: place.name,
                label: {
                  text: String(place.readyCount),
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                },
                icon: {
                  path: 'M0,-28 C15,-28 28,-15 28,0 C28,15 15,28 0,28 C-15,28 -28,15 -28,0 C-28,-15 -15,-28 0,-28 z',
                  fillColor: isSelected
                    ? '#0f172a'
                    : place.readyCount > 0
                      ? '#10b981'
                      : '#64748b',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: 0.8,
                  labelOrigin: {
                    x: 0,
                    y: 1,
                  },
                },
              })

          markerRefs.current.push(marker)
          bounds.extend({
            lat: place.lat,
            lng: place.lng,
          })

          if (useAdvancedMarkers && marker.addEventListener) {
            marker.addEventListener('gmp-click', () => {
              onSelectPlace(place.placeId)
            })
          } else {
            marker.addListener?.('click', () => {
              onSelectPlace(place.placeId)
            })
          }
        }

        if (locationCoords) {
          locationMarkerRef.current = useAdvancedMarkers
            ? new maps.AdvancedMarkerElement!({
                content: buildLocationMarkerNode(),
                map: mapRef.current,
                position: {
                  lat: locationCoords.latitude,
                  lng: locationCoords.longitude,
                },
                title: 'Your location',
              })
            : new maps.Marker({
                map: mapRef.current,
                position: {
                  lat: locationCoords.latitude,
                  lng: locationCoords.longitude,
                },
                title: 'Your location',
                icon: {
                  path: 'M0,-12 C6.627,-12 12,-6.627 12,0 C12,6.627 6.627,12 0,12 C-6.627,12 -12,6.627 -12,0 C-12,-6.627 -6.627,-12 0,-12 z',
                  fillColor: '#0ea5e9',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                  scale: 1,
                },
              })

          bounds.extend({
            lat: locationCoords.latitude,
            lng: locationCoords.longitude,
          })
        }

        if (locationCoords) {
          mapRef.current.setCenter({
            lat: locationCoords.latitude,
            lng: locationCoords.longitude,
          })
          mapRef.current.setZoom(17)
        } else {
          mapRef.current.fitBounds(bounds, 56)
        }
        setLoadingState('ready')
      })
      .catch((error) => {
        if (disposed) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load the real map right now.',
        )
        setLoadingState('idle')
      })

    return () => {
      disposed = true
    }
  }, [
    googleMapsApiKey,
    googleMapsMapId,
    locationCoords,
    mapsApiKey,
    onSelectPlace,
    places,
    selectedPlaceId,
  ])

  useEffect(() => {
    return () => {
      markerRefs.current.forEach((marker) => {
        marker.setMap?.(null)
      })
      markerRefs.current = []

      if (locationMarkerRef.current) {
        locationMarkerRef.current.setMap?.(null)
        locationMarkerRef.current = null
      }
    }
  }, [])

  return (
    <div className="mt-4 overflow-hidden rounded-[2rem] border border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.16),_transparent_34%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(241,245,249,0.96))] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Map view</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Real map. Real nearby places. Tap a pin to choose where you are.
          </p>
        </div>
        <div className="rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          Live nearby
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[1.75rem] border border-white/80 bg-slate-100 shadow-inner">
        <div ref={mapElementRef} className="aspect-[4/3] w-full" />

        {loadingState === 'config-loading' || loadingState === 'script-loading' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/75 text-slate-700 backdrop-blur-sm">
            <LoaderCircle className="h-6 w-6 animate-spin" />
            <p className="text-sm font-medium">
              {loadingState === 'config-loading'
                ? 'Preparing nearby places map...'
                : 'Loading real map...'}
            </p>
          </div>
        ) : null}

        {loadingState === 'idle' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 text-slate-700 backdrop-blur-sm">
            <MapPinned className="h-7 w-7" />
            <p className="text-sm font-medium">
              {loadError ?? 'Preparing nearby places map...'}
            </p>
          </div>
        ) : null}
      </div>

      {loadError ? (
        <p className="mt-3 text-sm text-rose-700">
          The list still works below. If this keeps happening, confirm that the
          Google key has the Maps JavaScript API enabled for this domain.
        </p>
      ) : null}
    </div>
  )
}

function buildPlaceMarkerNode({
  isSelected,
  readyCount,
}: {
  isSelected: boolean
  readyCount: number
}) {
  const marker = document.createElement('div')
  marker.className =
    'flex min-h-11 min-w-11 items-center justify-center rounded-full border-2 border-white px-3 text-sm font-bold text-white shadow-lg'
  marker.style.backgroundColor = isSelected
    ? '#0f172a'
    : readyCount > 0
      ? '#10b981'
      : '#64748b'
  marker.textContent = String(readyCount)
  return marker
}

function buildLocationMarkerNode() {
  const marker = document.createElement('div')
  marker.className =
    'h-5 w-5 rounded-full border-[3px] border-white bg-sky-500 shadow-lg'
  return marker
}
