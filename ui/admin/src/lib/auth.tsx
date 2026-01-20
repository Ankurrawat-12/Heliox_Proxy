'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Types
export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: 'admin' | 'owner' | 'member'
  tenant_id: string | null
  tenant_name: string | null
  plan_name: string | null
  email_verified: boolean
  created_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string, companyName: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// Token storage
const TOKEN_KEY = 'heliox_token'
const USER_KEY = 'heliox_user'

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(USER_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function storeAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// API helpers
async function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

// Provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // Initialize from storage
  useEffect(() => {
    const token = getStoredToken()
    const user = getStoredUser()
    
    if (token && user) {
      setState({
        user,
        token,
        isLoading: false,
        isAuthenticated: true,
      })
      // Refresh user data in background
      refreshUser()
    } else {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const response = await authFetch<User>('/auth/me')
      const token = getStoredToken()
      setState({
        user: response,
        token,
        isLoading: false,
        isAuthenticated: true,
      })
      if (token) {
        storeAuth(token, response)
      }
    } catch {
      // Token might be invalid
      clearAuth()
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authFetch<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    
    storeAuth(response.access_token, response.user)
    setState({
      user: response.user,
      token: response.access_token,
      isLoading: false,
      isAuthenticated: true,
    })
  }, [])

  const signup = useCallback(async (email: string, password: string, name: string, companyName: string) => {
    const response = await authFetch<{ access_token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, company_name: companyName }),
    })
    
    storeAuth(response.access_token, response.user)
    setState({
      user: response.user,
      token: response.access_token,
      isLoading: false,
      isAuthenticated: true,
    })
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Portal API (authenticated)
export const portalApi = {
  getTenant: async () => authFetch<any>('/portal/tenant'),
  getUsage: async () => authFetch<any>('/portal/usage'),
  getKeys: async () => authFetch<any[]>('/portal/keys'),
  createKey: async (name: string) => authFetch<any>('/portal/keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),
  deleteKey: async (id: string) => authFetch<void>(`/portal/keys/${id}`, { method: 'DELETE' }),
  getPlans: async () => authFetch<any[]>('/portal/plans'),
}
