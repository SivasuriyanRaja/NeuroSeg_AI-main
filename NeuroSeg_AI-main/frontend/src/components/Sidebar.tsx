// NeuroSeg AI — Sidebar with geometric logo
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Microscope, FolderOpen, FlaskConical, Settings, Brain, LogOut
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { to: '/',            label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/analyze',     label: 'Analyze',     icon: Microscope },
  { to: '/cases',       label: 'Cases',       icon: FolderOpen },
  { to: '/experiments', label: 'Experiments', icon: FlaskConical },
  { to: '/settings',    label: 'Settings',    icon: Settings },
]

export default function Sidebar() {
  const { logout } = useAuth()
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <NeuroSegLogo />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">NeuroSeg AI</span>
          <span className="sidebar-logo-sub">MRI Workspace</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon className="nav-icon" size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="btn btn-ghost" style={{ margin: '0 12px 12px', justifyContent: 'flex-start', color: 'var(--slate-400)' }} onClick={logout}>
        <LogOut size={16} /> Logout
      </button>

      {/* Bottom disclaimer */}
      <div style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--navy-700)' }}>
        <p style={{ fontSize: 10, color: 'var(--slate-600)', lineHeight: 1.5, margin: 0 }}>
          For research &amp; education only. Not for diagnosis.
        </p>
      </div>
    </aside>
  )
}

// Geometric SVG logo
function NeuroSegLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      {/* Outer hexagon */}
      <polygon points="11,2 19,6.5 19,15.5 11,20 3,15.5 3,6.5"
        fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.8"/>
      {/* Inner neural cross */}
      <circle cx="11" cy="11" r="2.5" fill="white" fillOpacity="0.9"/>
      <line x1="11" y1="5" x2="11" y2="8.5" stroke="white" strokeWidth="1.2" strokeOpacity="0.7"/>
      <line x1="11" y1="13.5" x2="11" y2="17" stroke="white" strokeWidth="1.2" strokeOpacity="0.7"/>
      <line x1="5" y1="11" x2="8.5" y2="11" stroke="white" strokeWidth="1.2" strokeOpacity="0.7"/>
      <line x1="13.5" y1="11" x2="17" y2="11" stroke="white" strokeWidth="1.2" strokeOpacity="0.7"/>
    </svg>
  )
}
