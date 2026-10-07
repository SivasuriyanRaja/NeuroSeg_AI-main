import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const fd = new URLSearchParams()
      fd.append('username', email)
      fd.append('password', password)

      const res = await api.post<{ access_token: string }>('/auth/login', fd, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      login(res.data.access_token)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in" style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      minHeight: '100vh', background: 'var(--navy-900)' 
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24, fontSize: 24, color: 'var(--teal-400)' }}>
          NeuroSeg AI
        </h2>
        <h3 style={{ textAlign: 'center', marginBottom: 24, fontSize: 18, color: 'var(--slate-200)' }}>
          Welcome Back
        </h3>
        
        {error && <div className="card" style={{ background: 'rgba(255,50,50,0.1)', color: 'var(--warning)', borderColor: 'rgba(255,50,50,0.2)', marginBottom: 16 }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Email Address</label>
            <input 
              type="email" 
              className="input" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)} 
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input 
              type="password" 
              className="input" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8, height: 44 }}>
            {loading ? <div className="spinner" /> : 'Log In'}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--slate-400)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--teal-400)', textDecoration: 'none' }}>Register</Link>
        </div>
      </div>
    </div>
  )
}
