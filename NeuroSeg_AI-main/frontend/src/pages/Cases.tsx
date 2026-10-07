// NeuroSeg AI — Cases list page
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCases, deleteCase } from '../api'
import type { CaseListItem } from '../api'
import { fmtDate, statusColor } from '../utils'
import { Search, FolderOpen, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 12

export default function Cases() {
  const [cases, setCases] = useState<CaseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const nav = useNavigate()

  const load = useCallback(() => {
    setLoading(true)
    getCases(page * PAGE_SIZE, PAGE_SIZE, search || undefined)
      .then(r => setCases(r.data))
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load() }, 400)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this case and all its files?')) return
    await deleteCase(id)
    load()
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cases</h1>
          <p className="page-sub">All uploaded MRI cases and analysis history</p>
        </div>
        <button className="btn btn-primary" onClick={() => nav('/analyze')}>
          <Plus size={16} /> New Case
        </button>
      </div>

      <div className="page-body">
        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--slate-500)', pointerEvents: 'none' }} />
          <input className="input" style={{ paddingLeft: 36 }}
            placeholder="Search by label…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="grid-3">
            {[...Array(6)].map((_, i) => <CaseSkeleton key={i} />)}
          </div>
        ) : cases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FolderOpen size={28} /></div>
            <p style={{ fontWeight: 500 }}>No cases found</p>
            <p style={{ fontSize: 12 }}>
              {search ? 'Try a different search term.' : 'Upload your first MRI to get started.'}
            </p>
            {!search && (
              <button className="btn btn-primary" onClick={() => nav('/analyze')}>
                <Plus size={15} /> Upload MRI
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid-3">
              {cases.map(c => (
                <CaseCard key={c.id} c={c}
                  onClick={() => nav(`/cases/${c.id}`)}
                  onDelete={(e) => handleDelete(e, c.id)} />
              ))}
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-ghost btn-sm"
                disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--slate-400)' }}>
                Page {page + 1}
              </span>
              <button className="btn btn-ghost btn-sm"
                disabled={cases.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CaseCard({ c, onClick, onDelete }: {
  c: CaseListItem
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer', transition: 'all 0.15s',
      display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Thumbnail */}
      <div style={{ width: '100%', height: 140, borderRadius: 8, overflow: 'hidden',
        background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {c.thumbnail_url ? (
          <img src={c.thumbnail_url} alt="thumbnail"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <FolderOpen size={32} style={{ color: 'var(--slate-700)' }} />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.label || <span style={{ color: 'var(--slate-500)' }}>Unlabeled case</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>{fmtDate(c.created_at)}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`badge ${statusColor[c.job_status ?? ''] ?? 'badge-none'}`}>
          {c.job_status ?? 'no job'}
        </span>
        <button className="btn btn-danger btn-sm" onClick={onDelete}
          style={{ padding: '4px 8px' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function CaseSkeleton() {
  return (
    <div className="card" style={{ gap: 12 }}>
      <div className="skeleton" style={{ height: 140, borderRadius: 8 }} />
      <div className="skeleton" style={{ height: 16, width: '70%' }} />
      <div className="skeleton" style={{ height: 12, width: '40%' }} />
    </div>
  )
}
