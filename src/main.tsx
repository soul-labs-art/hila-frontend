import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from './session'
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter><QueryClientProvider client={queryClient}><SessionProvider><App /></SessionProvider></QueryClientProvider></BrowserRouter>
  </StrictMode>,
)
