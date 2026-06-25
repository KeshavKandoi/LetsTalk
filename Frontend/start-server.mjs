import { serve } from '@hono/node-server'
import handler from './dist/server/server.js'

serve({
  fetch: handler.fetch,
  port: parseInt(process.env.PORT || '8080'),
}, (info) => {
  console.log(`Server running on port ${info.port}`)
})
