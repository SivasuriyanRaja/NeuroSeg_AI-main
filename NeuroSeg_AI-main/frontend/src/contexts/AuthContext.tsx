import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

interface User {
  id: string
  email: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
      // Verify token and fetch user
      api.get<User>('/auth/me')
        .then(res => {
          setUser(res.data)
        })
        .catch(() => {
          logout()
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      localStorage.removeItem('token')
      setUser(null)
      setLoading(false)
    }
  }, [token])

  const login = (newToken: string) => {
    setToken(newToken)
    navigate('/')
  }

  const logout = () => {
    setToken(null)
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
