declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsNamespace
    }
  }
}

type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void
}

type GoogleLatLngBounds = {
  extend: (position: { lat: number; lng: number }) => void
}

type GoogleMapsLibrary = {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => GoogleMapInstance
}

type GoogleMarkerInstance = {
  addEventListener?: (eventName: string, handler: () => void) => void
  addListener?: (eventName: string, handler: () => void) => void
  map?: GoogleMapInstance | null
  setMap?: (map: GoogleMapInstance | null) => void
}

type GoogleMarkerLibrary = {
  AdvancedMarkerElement: new (options: {
    content?: Node
    gmpClickable?: boolean
    map: GoogleMapInstance
    position: {
      lat: number
      lng: number
    }
    title?: string
  }) => GoogleAdvancedMarkerInstance
}

type GoogleAdvancedMarkerInstance = {
  addEventListener?: (eventName: string, handler: () => void) => void
  addListener?: (eventName: string, handler: () => void) => void
  map?: GoogleMapInstance | null
}

type GoogleMapsNamespace = {
  Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance
  importLibrary: (
    name: 'maps' | 'marker',
  ) => Promise<GoogleMapsLibrary | GoogleMarkerLibrary>
  LatLngBounds: new () => GoogleLatLngBounds
  __ib__?: () => void
}

type LoadedGoogleMapsLibraries = {
  AdvancedMarkerElement: GoogleMarkerLibrary['AdvancedMarkerElement'] | null
  LatLngBounds: GoogleMapsNamespace['LatLngBounds']
  Map: GoogleMapsLibrary['Map']
  Marker: GoogleMapsNamespace['Marker']
}

let bootstrapInstalledForKey: string | null = null
let loadedApiKey: string | null = null

function ensureBootstrap(apiKey: string) {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps can only load in the browser.')
  }

  if (window.google?.maps?.importLibrary) {
    return
  }

  if (bootstrapInstalledForKey === apiKey) {
    return
  }

  bootstrapInstalledForKey = apiKey
  loadedApiKey = apiKey

  ;((options: { key: string; v: string }) => {
    const googleNamespace = 'google'
    const importLibraryName = 'importLibrary'
    const callbackName = '__ib__'
    const win = window as unknown as Window & Record<string, unknown>
    const documentRef = document
    const googleObject =
      (win[googleNamespace] as { maps?: GoogleMapsNamespace } | undefined) ?? {}
    win[googleNamespace] = googleObject
    const mapsObject =
      (googleObject.maps as GoogleMapsNamespace | undefined) ??
      ({} as GoogleMapsNamespace)
    googleObject.maps = mapsObject
    const pendingLibraries = new Set<string>()
    const searchParams = new URLSearchParams()
    let scriptLoadPromise: Promise<void> | null = null

    const requestScript = () => {
      if (scriptLoadPromise) {
        return scriptLoadPromise
      }

      scriptLoadPromise = new Promise<void>((resolve, reject) => {
        const script = documentRef.createElement('script')

        searchParams.set('libraries', [...pendingLibraries].join(','))

        for (const [key, value] of Object.entries(options)) {
          searchParams.set(
            key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`),
            String(value),
          )
        }

        searchParams.set('callback', `${googleNamespace}.maps.${callbackName}`)
        script.src = `https://maps.googleapis.com/maps/api/js?${searchParams.toString()}`
        script.async = true
        script.onerror = () => {
          scriptLoadPromise = null
          reject(new Error('Unable to load Google Maps right now.'))
        }

        mapsObject[callbackName] = () => {
          resolve()
        }

        const nonceScript = documentRef.querySelector<HTMLScriptElement>(
          'script[nonce]',
        )
        script.nonce = nonceScript?.nonce ?? ''
        documentRef.head.appendChild(script)
      })

      return scriptLoadPromise
    }

    if (!mapsObject[importLibraryName]) {
      mapsObject[importLibraryName] = ((
        libraryName: 'maps' | 'marker',
      ) => {
        pendingLibraries.add(libraryName)
        return requestScript().then(() =>
          mapsObject[importLibraryName](libraryName),
        )
      }) as GoogleMapsNamespace['importLibrary']
    }
  })({
    key: apiKey,
    v: 'weekly',
  })
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(
        new Error(
          'Google Maps timed out while loading. Check that the Maps JavaScript API is enabled and that this domain is allowed by the key restrictions.',
        ),
      )
    }, timeoutMs)

    promise
      .then((value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      })
  })
}

export async function loadGoogleMapsApi(
  apiKey: string,
  options?: {
    loadMarkerLibrary?: boolean
  },
) {
  ensureBootstrap(apiKey)

  const mapsNamespace = window.google?.maps

  if (!mapsNamespace?.importLibrary) {
    throw new Error('Google Maps bootstrap did not install correctly.')
  }

  const [mapsLibrary, markerLibrary] = await withTimeout(
    Promise.all([
      mapsNamespace.importLibrary('maps') as Promise<GoogleMapsLibrary>,
      options?.loadMarkerLibrary
        ? (mapsNamespace.importLibrary('marker') as Promise<GoogleMarkerLibrary>)
        : Promise.resolve(null),
    ]),
    15000,
  )

  return {
    AdvancedMarkerElement: markerLibrary?.AdvancedMarkerElement ?? null,
    LatLngBounds: mapsNamespace.LatLngBounds,
    Map: mapsLibrary.Map,
    Marker: mapsNamespace.Marker,
  } satisfies LoadedGoogleMapsLibraries
}

export function getLoadedGoogleMapsApiKey() {
  return loadedApiKey
}
