import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, Animated, Vibration,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { apiFetch } from '../lib/api'

interface Props {
  onClose: () => void
  onConnected: (message: string) => void
}

export default function ScannerModal({ onClose, onConnected }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scanLine = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!permission?.granted) requestPermission()
    // Animate scan line
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  const extractToken = (raw: string) => {
    try {
      const url = new URL(raw)
      return url.searchParams.get('scan') || raw
    } catch {
      return raw
    }
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return
    setScanned(true)
    Vibration.vibrate(100)
    await doPreview(extractToken(data))
  }

  const doPreview = async (rawToken: string) => {
    const t = rawToken.trim()
    if (!t) { setError('No token found.'); setScanned(false); return }
    setLoading(true)
    setError('')
    try {
      const result = await apiFetch('/api/places/scan-preview', { token: t })
      await apiFetch('/api/places/scan-connect', { token: t })
      setPreview({ ...result, resolvedToken: t, connected: true })
      onConnected(`Connected with ${result.counterpart?.username} and verified at this place.`)
    } catch (e: any) {
      setError(e.message || 'Could not verify this connection.')
      setScanned(false)
    } finally {
      setLoading(false)
    }
  }

  const resetScan = () => {
    setPreview(null)
    setScanned(false)
    setError('')
  }

  const scanLineY = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  })

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.label}>SCAN QR</Text>
              <Text style={s.title}>Scan to add a friend</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

        

          {preview ? (
            /* Preview card */
            <View style={s.previewCard}>
              <Text style={s.previewLabel}>Friend request sent to</Text>
              <Text style={s.previewName}>{preview.counterpart?.username}</Text>
              <Text style={s.previewMood}>
                {preview.counterpart?.moodEmoji} {preview.counterpart?.intentSummary || 'Open to a conversation.'}
              </Text>
              <View style={s.previewPlace}>
                <Text style={s.previewPlaceTxt}>📍 {preview.placeName}</Text>
              </View>
              <Text style={s.successHint}>
                They need to accept before you become friends.
              </Text>
              <TouchableOpacity style={s.connectBtn} onPress={onClose}>
                <Text style={s.connectTxt}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={resetScan}>
                <Text style={s.cancelTxt}>Scan another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Camera view */
            permission?.granted ? (
              <View style={s.cameraWrap}>
                <CameraView
                  style={s.camera}
                  facing="back"
                  onBarcodeScanned={handleBarCodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />
                {/* Scan frame overlay */}
                <View style={s.scanOverlay}>
                  <View style={s.scanFrame}>
                    <View style={[s.corner, s.cornerTL]} />
                    <View style={[s.corner, s.cornerTR]} />
                    <View style={[s.corner, s.cornerBL]} />
                    <View style={[s.corner, s.cornerBR]} />
                    <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineY }] }]} />
                  </View>
                </View>
                {loading && (
                  <View style={s.scanLoading}>
                    <ActivityIndicator color="white" size="large" />
                    <Text style={s.scanLoadingTxt}>Previewing...</Text>
                  </View>
                )}
                <Text style={s.cameraHint}>Point at someone's QR code</Text>
              </View>
            ) : (
              <View style={s.permissionBox}>
                <Text style={s.permissionEmoji}>📷</Text>
                <Text style={s.permissionTitle}>Camera access needed</Text>
                <Text style={s.permissionHint}>Allow camera to scan QR codes nearby</Text>
                <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
                  <Text style={s.permissionBtnTxt}>Allow Camera</Text>
                </TouchableOpacity>
              </View>
            )

          )}

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const GREEN = '#1a6b3c'
const DARK = '#0f3320'
const MID = '#2d6e3e'

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,51,32,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#f0faf0', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '700', color: GREEN, letterSpacing: 2, marginBottom: 3 },
  title: { fontSize: 22, fontWeight: '800', color: DARK },
  closeBtn: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(144,212,144,0.6)', paddingHorizontal: 10, paddingVertical: 6 },
  closeTxt: { fontSize: 14, color: MID, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(26,107,60,0.08)', borderRadius: 16, padding: 4, marginBottom: 16, gap: 4 },
  tab: { flex: 1, borderRadius: 13, paddingVertical: 9, alignItems: 'center' },
  tabActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabTxt: { fontSize: 13, color: MID, fontWeight: '600' },
  tabTxtActive: { color: DARK, fontWeight: '700' },
  cameraWrap: { borderRadius: 20, overflow: 'hidden', height: 340, marginBottom: 12, position: 'relative', backgroundColor: '#000' },
  camera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scanOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 220, height: 220, position: 'relative' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: 'white', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: { position: 'absolute', left: 4, right: 4, height: 2, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 1 },
  scanLoading: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,51,32,0.7)', justifyContent: 'center', alignItems: 'center', gap: 10 },
  scanLoadingTxt: { color: 'white', fontWeight: '700', fontSize: 15 },
  cameraHint: { position: 'absolute', bottom: 14, alignSelf: 'center', color: 'white', fontSize: 13, fontWeight: '600', backgroundColor: 'rgba(15,51,32,0.5)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  permissionBox: { alignItems: 'center', padding: 32, gap: 10 },
  permissionEmoji: { fontSize: 40 },
  permissionTitle: { fontSize: 17, fontWeight: '700', color: DARK },
  permissionHint: { fontSize: 13, color: MID, textAlign: 'center' },
  permissionBtn: { backgroundColor: GREEN, borderRadius: 50, paddingVertical: 12, paddingHorizontal: 28, marginTop: 8 },
  permissionBtnTxt: { color: 'white', fontWeight: '700', fontSize: 15 },
  previewCard: { backgroundColor: 'rgba(26,107,60,0.09)', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(26,107,60,0.2)', gap: 8 },
  previewLabel: { fontSize: 12, color: MID, fontWeight: '600' },
  previewName: { fontSize: 24, fontWeight: '800', color: DARK },
  previewMood: { fontSize: 14, color: MID, lineHeight: 20 },
  previewPlace: { backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  previewPlaceTxt: { fontSize: 13, color: MID },
  successHint: { fontSize: 13, color: MID, lineHeight: 19, marginTop: 4 },
  connectBtn: { backgroundColor: GREEN, borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  connectTxt: { color: 'white', fontWeight: '700', fontSize: 15 },
  cancelBtn: { backgroundColor: 'white', borderRadius: 50, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(144,212,144,0.6)' },
  cancelTxt: { color: GREEN, fontWeight: '700', fontSize: 15 },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#fca5a5' },
  errorTxt: { color: '#dc2626', fontSize: 13 },
})
