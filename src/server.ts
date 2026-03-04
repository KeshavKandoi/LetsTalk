import { env } from 'cloudflare:workers'
import { routeAgentRequest } from 'agents'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { PlaceAgent } from './lib/server/agents/place-agent'
import { UserAgent } from './lib/server/agents/user-agent'

const handleStart = createStartHandler(defaultStreamHandler)

export { PlaceAgent, UserAgent }

export default createServerEntry({
  async fetch(request, opts) {
    return (await routeAgentRequest(request, env)) ?? handleStart(request, opts)
  },
})
