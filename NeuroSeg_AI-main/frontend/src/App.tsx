import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Analyze from './pages/Analyze'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import Experiments from './pages/Experiments'
import SettingsPage from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import './index.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  
  if (loading) {
    return <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--navy-900)' }}><div className="spinner" /></div>
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="*" element={
            <ProtectedRoute>
              <div className="app-shell">
                <Sidebar />
                <main className="main-content">
                  <Routes>
                    <Route path="/"             element={<Dashboard />} />
                    <Route path="/analyze"      element={<Analyze />} />
                    <Route path="/cases"        element={<Cases />} />
                    <Route path="/cases/:caseId" element={<CaseDetail />} />
                    <Route path="/experiments"  element={<Experiments />} />
                    <Route path="/settings"     element={<SettingsPage />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
