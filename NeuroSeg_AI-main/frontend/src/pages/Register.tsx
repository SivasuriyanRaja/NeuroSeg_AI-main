import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (password !== confirmPassword) {
      return setError('Passwords do not match')
    }

    setLoading(true)
    try {
      await api.post('/auth/register', { email, password })
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register')
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
          Create an Account
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
          <div>
            <label className="label">Confirm Password</label>
            <input 
              type="password" 
              className="input" 
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} 
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8, height: 44 }}>
            {loading ? <div className="spinner" /> : 'Register'}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--slate-400)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--teal-400)', textDecoration: 'none' }}>Log In</Link>
        </div>
      </div>
    </div>
  )
}
