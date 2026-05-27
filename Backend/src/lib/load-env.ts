import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const backendRoot = resolve(currentDir, '../..')

config({ path: resolve(backendRoot, '.env') })
config({ path: resolve(backendRoot, '.dev.vars'), override: false })
