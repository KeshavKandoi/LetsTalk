import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'

export function useNetworkCheck() {
  const [isConnected, setIsConnected] = useState<boolean>(true)

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true)
    })
    return () => unsub()
  }, [])

  return isConnected
}
