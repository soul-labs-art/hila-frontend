import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const { HILA_API_URL = 'http://127.0.0.1:8080' } = loadEnv(mode, process.cwd(), 'HILA_')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': HILA_API_URL,
        '/swagger-ui': HILA_API_URL,
        '/v3/api-docs': HILA_API_URL,
      },
    },
  }
})
