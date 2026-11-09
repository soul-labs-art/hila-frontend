import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'production' && loadEnv(mode, process.cwd(), 'VITE_').VITE_API_MOCK === 'true')
    throw new Error('VITE_API_MOCK=true solo es para desarrollo: los datos de ejemplo no pueden incluirse en un build de producción. Quita la variable e inténtalo de nuevo.')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:8080',
        '/swagger-ui': 'http://127.0.0.1:8080',
        '/v3/api-docs': 'http://127.0.0.1:8080',
      },
    },
  }
})
