// NeuroSeg AI — Dashboard page
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard } from '../api'
import type { DashboardStats, AnalysisJob } from '../api'
import { fmtDate, fmtMs, statusColor, fmtDateTime } from '../utils'
import {
  FolderOpen, CheckCircle, Loader2, AlertCircle, Plus, Brain, Clock, Activity
} from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    getDashboard()
      .then(r => setStats(r.data))
      .catch(() => setError('Could not load dashboard. Is the API running?'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingDashboard />
  if (error) return <ErrorState msg={error} />

  const s = stats!

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Research workspace overview</p>
        </div>
        <button className="btn btn-primary" onClick={() => nav('/analyze')}>
          <Plus size={16} /> New Analysis
        </button>
      </div>

      <div className="page-body">
        {/* Disclaimer */}
        <div className="disclaimer">
          <AlertCircle size={14} />
          For research and education only; not for diagnosis or treatment.
        </div>

        {/* Stat cards */}
        <div className="grid-4">
          <StatCard
            icon={<FolderOpen size={22} />}
            iconBg="rgba(59,130,246,0.15)"
            iconColor="var(--info)"
            label="Total Cases"
            value={s.total_cases}
          />
          <StatCard
            icon={<CheckCircle size={22} />}
            iconBg="rgba(16,185,129,0.15)"
            iconColor="var(--success)"
            label="Completed Analyses"
            value={s.completed_analyses}
          />
          <StatCard
            icon={<Loader2 size={22} />}
            iconBg="rgba(245,158,11,0.15)"
            iconColor="var(--warning)"
            label="Running / Queued"
            value={`${s.running_jobs} / ${s.queued_jobs}`}
          />
          <StatCard
            icon={<AlertCircle size={22} />}
            iconBg="rgba(239,68,68,0.15)"
            iconColor="var(--error)"
            label="Failed Jobs"
            value={s.failed_jobs}
          />
        </div>

        <div className="grid-2">
          {/* Active model */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Brain size={18} style={{ color: 'var(--teal-400)' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Active Model</span>
            </div>
            {s.active_model ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal-400)' }}>
                  {s.active_model.name}
                </div>
                <div style={{ color: 'var(--slate-500)', fontSize: 12 }}>
                  {s.active_model.architecture} · v{s.active_model.version_tag}
                </div>
                <div style={{ color: 'var(--slate-500)', fontSize: 12 }}>
                  Input: {s.active_model.input_size}×{s.active_model.input_size}px ·
                  Threshold: {s.active_model.threshold}
                </div>
                <div style={{ color: 'var(--slate-600)', fontSize: 11, marginTop: 4 }}>
                  {s.active_model.dataset_provenance}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <p style={{ fontSize: 13 }}>No model registered. Run the training CLI first.</p>
              </div>
            )}
          </div>

          {/* Quick start */}
          <div className="card"
            style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.08), rgba(15,22,36,0))',
              borderColor: 'rgba(20,184,166,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Activity size={18} style={{ color: 'var(--teal-400)' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Quick Start</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Step n={1} text="Upload a brain MRI PNG/JPEG" done={s.total_cases > 0} />
              <Step n={2} text="Select a segmentation model" done={!!s.active_model} />
              <Step n={3} text="Run analysis and inspect results" done={s.completed_analyses > 0} />
              <Step n={4} text="Export a research report" done={false} />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}
              onClick={() => nav('/analyze')}>
              <Plus size={15} /> Start New Analysis
            </button>
          </div>
        </div>

        {/* Recent jobs */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Clock size={18} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Recent Jobs</span>
          </div>
          {s.recent_jobs.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-icon"><Clock size={28} /></div>
              <p>No analysis jobs yet. Upload a case to get started.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Status</th>
                    <th>Threshold</th>
                    <th>Queued</th>
                    <th>Processing</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recent_jobs.map(job => (
                    <tr key={job.id} onClick={() => nav(`/cases/${job.case_id}`)}>
                      <td><code style={{ fontSize: 11 }}>{job.id.slice(0, 8)}…</code></td>
                      <td><span className={`badge ${statusColor[job.status] ?? 'badge-none'}`}>{job.status}</span></td>
                      <td>{job.threshold}</td>
                      <td>{fmtDateTime(job.queued_at)}</td>
                      <td style={{ color: 'var(--slate-400)' }}>{fmtMs(job.processing_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, iconBg, iconColor, label, value }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string | number
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function Step({ n, text, done }: { n: number; text: string; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: done ? 'var(--success)' : 'var(--navy-700)',
        color: done ? 'white' : 'var(--slate-500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0
      }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 13, color: done ? 'var(--slate-300)' : 'var(--slate-500)',
        textDecoration: done ? 'line-through' : 'none' }}>
        {text}
      </span>
    </div>
  )
}

function LoadingDashboard() {
  return (
    <div className="page-body fade-in">
      <div className="grid-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
            <div className="skeleton" style={{ width: 60, height: 28 }} />
            <div className="skeleton" style={{ width: 100, height: 12 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <div className="page-body fade-in">
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <AlertCircle size={40} style={{ color: 'var(--error)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--slate-400)' }}>{msg}</p>
      </div>
    </div>
  )
}
