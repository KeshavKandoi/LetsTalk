import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  preview: {
    allowedHosts: ['letstalks.app', 'letstalk-production-cd3a.up.railway.app'],
  },
  publicDir: 'public',
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src',
      server: {
        entry: '../Backend/src/server.ts',
      },
    }),
    viteReact(),
  ],
})
