import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    sourcemap: true,
  },
  define: {
    'import.meta.env.npm_package_version': JSON.stringify(process.env.npm_package_version || process.env.VITE_APP_VERSION || '1.0.0'),
  },
})
