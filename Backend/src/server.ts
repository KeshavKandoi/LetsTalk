import './lib/load-env'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'

const handleStart = createStartHandler(defaultStreamHandler)

export default createServerEntry({
  async fetch(request, opts) {
    return handleStart(request, opts)
  },
})
