import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useLocation } from 'wouter'
import api from '../api'

export interface User {
  id: string
  email: string
  username?: string
  prefix?: string
  role: string
  first_name: string
  last_name: string
  profession: string
  display_name: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, userData?: User | null, redirectPath?: string) => void
  logout: () => void
  updateUser: (data: Partial<User>) => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('token')
    } catch {
      return null
    }
  })

  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [loading, setLoading] = useState(true)
  const [, setLocation] = useLocation()

  useEffect(() => {
    if (token) {
      try {
        localStorage.setItem('token', token)
      } catch {}
      // Verify token and fetch fresh user profile
      api.get<User>('/auth/me')
        .then(res => {
          setUser(res.data)
          try {
            localStorage.setItem('user', JSON.stringify(res.data))
          } catch {}
        })
        .catch(err => {
          console.warn('Failed to fetch /auth/me:', err)
          if (err?.response?.status === 401 && !localStorage.getItem('user')) {
            logout()
          }
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } catch {}
      setUser(null)
      setLoading(false)
    }
  }, [token])

  const login = (newToken: string, userData?: User | null, redirectPath: string = '/dashboard') => {
    try {
      localStorage.setItem('token', newToken)
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
      }
    } catch (e) {
      console.error(e)
    }
    setToken(newToken)
    if (redirectPath) {
      setLocation(redirectPath)
    }
  }

  const logout = () => {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    } catch {}
    setToken(null)
    setUser(null)
    setLocation('/login')
  }

  const updateUser = (data: Partial<User>) => {
    setUser(prev => {
      const updated = prev ? { ...prev, ...data } : (data as User)
      try {
        localStorage.setItem('user', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
