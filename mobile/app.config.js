const appJson = require('./app.json')

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY

module.exports = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
  },
  plugins: appJson.expo.plugins.map((plugin) => (
    Array.isArray(plugin) && plugin[0] === 'react-native-maps'
      ? ['react-native-maps', googleMapsApiKey ? { googleMapsApiKey } : {}]
      : plugin
  )),
}
