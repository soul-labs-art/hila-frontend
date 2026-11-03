import { createContext, useContext } from 'react'
import type { Schemas } from './api/client'
export type User = Schemas['CurrentUser']
export type Session = { user: User | null; loading: boolean; error: Error | null; refresh: () => Promise<unknown>; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> }
export const Context = createContext<Session | null>(null)
export function useSession() { const value = useContext(Context); if (!value) throw new Error('Falta SessionProvider'); return value }
