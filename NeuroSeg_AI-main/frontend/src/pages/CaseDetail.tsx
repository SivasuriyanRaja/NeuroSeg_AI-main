// NeuroSeg AI — Case detail page with image workspace and results inspector
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import {
  getCase, getCaseJobs, getJobResult, createReport, assetUrl, updateCase,
  getRevisions, createRevision, selectRevision
} from '../api'
import type { Case, AnalysisJob, AnalysisResult, MaskRevision } from '../api'
import { fmtDateTime, fmtMs, fmtPct, statusColor } from '../utils'
import {
  ArrowLeft, Download, Save, Eye, Layers, RotateCcw,
  AlertTriangle, CheckCircle, Loader2, SlidersHorizontal, Edit3
} from 'lucide-react'
import MaskEditor from '../components/MaskEditor'

type ViewMode = 'original' | 'overlay' | 'mask' | 'probmap'

export default function CaseDetail() {
  const { caseId } = useParams<{ caseId: string }>()
  const nav = useNavigate()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [jobs, setJobs] = useState<AnalysisJob[]>([])
  const [selectedJob, setSelectedJob] = useState<AnalysisJob | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('original')
  const [opacity, setOpacity] = useState(0.6)
  const [threshold, setThreshold] = useState(0.5)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [revisions, setRevisions] = useState<MaskRevision[]>([])
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!caseId) return
    Promise.all([getCase(caseId), getCaseJobs(caseId)])
      .then(([caseRes, jobsRes]) => {
        setCaseData(caseRes.data)
        setNotes(caseRes.data.notes)
        setJobs(jobsRes.data)
        const completed = jobsRes.data.find(j => j.status === 'completed')
        if (completed) {
          setSelectedJob(completed)
          getJobResult(completed.id).then(r => setResult(r.data))
          getRevisions(completed.id).then(r => setRevisions(r.data))
        }
      })
      .catch(() => setError('Failed to load case.'))
      .finally(() => setLoading(false))
  }, [caseId])

  const origAsset = caseData?.assets.find(a => a.asset_type === 'original')

  const getImageSrc = () => {
    if (!selectedJob || !result) {
      return origAsset ? assetUrl(origAsset.filename, 'upload') : null
    }
    const r = result as any
    const activeRev = revisions.find(rv => rv.is_selected)
    switch (viewMode) {
      case 'overlay':   return r.overlay_filename ? assetUrl(r.overlay_filename) : null
      case 'mask':      return activeRev ? assetUrl(activeRev.mask_path) : (r.mask_filename ? assetUrl(r.mask_filename) : null)
      case 'probmap':   return r.prob_map_filename ? assetUrl(r.prob_map_filename) : null
      default: return origAsset ? assetUrl(origAsset.filename, 'upload') : null
    }
  }

  const handleSaveNotes = async () => {
    if (!caseId) return
    setSaving(true)
    await updateCase(caseId, { notes })
    setSaving(false)
  }

  const handleExport = async (format: string) => {
    if (!selectedJob) return
    setExporting(true)
    try {
      const rep = await createReport(selectedJob.id, format)
      window.open(`/api/reports/${rep.data.id}/download`, '_blank')
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <CaseSkeleton />
  if (error || !caseData) return (
    <div className="page-body"><div className="card">{error ?? 'Case not found.'}</div></div>
  )

  const imgSrc = getImageSrc()

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--navy-700)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--navy-900)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/cases')}>
          <ArrowLeft size={14} /> Cases
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {caseData.label || 'Unlabeled case'}
          </span>
          <span style={{ color: 'var(--slate-500)', fontSize: 12, marginLeft: 12 }}>
            {fmtDateTime(caseData.created_at)}
          </span>
        </div>
        {/* Export dropdown */}
        <div style={{ display: 'flex', gap: 8 }}>
          {['pdf', 'json', 'csv', 'png_overlay', 'png_mask', 'zip'].map(fmt => (
            <button key={fmt} className="btn btn-ghost btn-sm"
              disabled={!selectedJob || selectedJob.status !== 'completed' || exporting}
              onClick={() => handleExport(fmt)}>
              {exporting ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Download size={13} />}
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ─ Left: viewer ─ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          background: '#000', position: 'relative', minWidth: 0 }}>
          {/* View mode tabs */}
          <div style={{ display: 'flex', gap: 4, padding: '10px 12px',
            background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid var(--navy-800)' }}>
            {(['original', 'overlay', 'mask', 'probmap'] as ViewMode[]).map(mode => (
              <button key={mode}
                className={`btn btn-sm ${viewMode === mode ? 'btn-primary' : 'btn-ghost'}`}
                disabled={(mode !== 'original' && !result) || isEditing}
                onClick={() => setViewMode(mode)}>
                {mode === 'probmap' ? 'Prob Map' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
            {viewMode === 'probmap' && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center',
                gap: 8, color: 'var(--slate-400)', fontSize: 12 }}>
                <AlertTriangle size={13} style={{ color: 'var(--warning)' }} />
                Model ambiguity
              </div>
            )}
            {!isEditing && result && (
              <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }}
                onClick={() => setIsEditing(true)}>
                <Edit3 size={14} /> Edit Mask
              </button>
            )}
          </div>

          {/* Zoom/pan image */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex',
            alignItems: 'center', justifyContent: 'center' }}>
            {isEditing && origAsset ? (
              <MaskEditor 
                imageUrl={assetUrl(origAsset.filename, 'upload')} 
                initialMaskUrl={revisions.find(r => r.is_selected) 
                  ? assetUrl(revisions.find(r => r.is_selected)!.mask_path) 
                  : ((result as any).mask_filename ? assetUrl((result as any).mask_filename) : null)}
                onSave={async (blob, notes) => {
                  if (selectedJob) {
                    try {
                      await createRevision(selectedJob.id, blob, notes, revisions.length)
                      const revs = await getRevisions(selectedJob.id)
                      setRevisions(revs.data)
                      setIsEditing(false)
                    } catch (e: any) {
                      if (e.response?.status === 409) {
                        alert("Cannot save: another revision was created by a different tab/user.")
                      } else {
                        alert("Failed to save revision.")
                      }
                    }
                  }
                }}
                onCancel={() => setIsEditing(false)}
              />
            ) : imgSrc ? (
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={8}
                centerOnInit
              >
                {({ resetTransform }) => (
                  <>
                    <div style={{ position: 'absolute', top: 60, right: 12, zIndex: 10,
                      display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => resetTransform()}>
                        <RotateCcw size={13} /> Reset
                      </button>
                    </div>
                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                      <img
                        src={imgSrc}
                        alt={viewMode}
                        style={{
                          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                          opacity: viewMode === 'overlay' ? opacity : 1,
                        }}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            ) : (
              <div style={{ color: 'var(--slate-600)', textAlign: 'center' }}>
                <Eye size={40} style={{ margin: '0 auto 12px', display: 'block' }} />
                <p>No image available for this view</p>
              </div>
            )}
          </div>

          {/* Opacity slider for overlay */}
          {viewMode === 'overlay' && (
            <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', gap: 12 }}>
              <Layers size={14} style={{ color: 'var(--teal-400)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--slate-400)', flexShrink: 0 }}>Opacity</span>
              <input type="range" className="slider" style={{ flex: 1 }}
                min={0} max={1} step={0.05}
                value={opacity} onChange={e => setOpacity(Number(e.target.value))} />
              <span style={{ fontSize: 12, color: 'var(--slate-400)', width: 32 }}>{opacity.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* ─ Right: inspector ─ */}
        <div style={{ width: 320, borderLeft: '1px solid var(--navy-700)',
          background: 'var(--navy-900)', overflowY: 'auto', display: 'flex',
          flexDirection: 'column' } as any}>

          {/* Jobs selector */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--navy-700)' }}>
            <label className="label">Analysis Run</label>
            <select className="input" style={{ appearance: 'none' }}
              value={selectedJob?.id ?? ''}
              onChange={async e => {
                const j = jobs.find(jb => jb.id === e.target.value)
                if (!j) return
                setSelectedJob(j)
                if (j.status === 'completed') {
                  const r = await getJobResult(j.id)
                  setResult(r.data)
                  const revs = await getRevisions(j.id)
                  setRevisions(revs.data)
                }
              }}>
              {jobs.length === 0
                ? <option>No jobs yet</option>
                : jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.id.slice(0, 8)} · {j.status} · {fmtDateTime(j.queued_at)}
                    </option>
                  ))
              }
            </select>
            {selectedJob && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span className={`badge ${statusColor[selectedJob.status]}`}>{selectedJob.status}</span>
                <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                  {fmtMs(selectedJob.processing_ms)}
                </span>
              </div>
            )}
            {selectedJob?.error_message && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--error)',
                background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '6px 10px' }}>
                {selectedJob.error_message.slice(0, 200)}
              </div>
            )}
          </div>

          {/* Measurements */}
          {result && (
            <div style={{ padding: 16, borderBottom: '1px solid var(--navy-700)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 6 }}>
                <SlidersHorizontal size={14} style={{ color: 'var(--teal-400)' }} />
                Results
              </div>
              
              {result.predicted_class && (
                <div style={{ marginBottom: 16, padding: '12px', background: 'rgba(45,212,191,0.1)', borderRadius: 8, border: '1px solid var(--teal-900)' }}>
                  <div style={{ fontSize: 11, color: 'var(--teal-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Predicted Class
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--teal-50)', textTransform: 'capitalize', marginBottom: 8 }}>
                    {result.predicted_class}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--navy-700)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(result.predicted_confidence || 0) * 100}%`, height: '100%', background: 'var(--teal-500)' }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--slate-400)', width: 40, textAlign: 'right' }}>
                      {fmtPct(result.predicted_confidence || 0)}
                    </div>
                  </div>
                </div>
              )}

              {result.foreground_pixels === 0 && !result.predicted_class ? (
                <div className="disclaimer" style={{ fontSize: 11 }}>
                  No foreground region predicted at this threshold.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Metric label="Foreground pixels" value={result.foreground_pixels.toLocaleString()} />
                  <Metric label="Total pixels" value={result.total_pixels.toLocaleString()} />
                  <Metric label="Foreground fraction" value={fmtPct(result.foreground_fraction)} />
                  <Metric label="Connected components" value={String(result.connected_component_count)} />
                  {result.bounding_box && (
                    <Metric label="Bounding box"
                      value={`x${result.bounding_box.x} y${result.bounding_box.y} ${result.bounding_box.w}×${result.bounding_box.h}px`} />
                  )}
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 10, color: 'var(--slate-600)', lineHeight: 1.5 }}>
                * Measurements are in pixels. No pixel spacing available. Foreground region is a
                model mask component, not a confirmed tumor region.
              </div>
            </div>
          )}

          {/* Revisions */}
          {result && revisions.length > 0 && (
            <div style={{ padding: 16, borderBottom: '1px solid var(--navy-700)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Mask Revisions</div>
              <div style={{ fontSize: 10, color: 'var(--slate-500)', marginBottom: 12, lineHeight: 1.4 }}>
                Edits are user-reviewed annotations for research, not validated medical ground truth.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div 
                  style={{ padding: '8px 12px', background: !revisions.some(r => r.is_selected) ? 'rgba(20,184,166,0.15)' : 'var(--navy-800)', border: `1px solid ${!revisions.some(r => r.is_selected) ? 'var(--teal-500)' : 'transparent'}`, borderRadius: 6, cursor: 'not-allowed', fontSize: 12, opacity: 0.7 }}
                >
                  Original Model Mask {(!revisions.some(r => r.is_selected)) && '(Selected)'}
                </div>
                {revisions.map(rev => (
                  <div key={rev.id}
                    onClick={async () => {
                      if (rev.is_selected) return
                      await selectRevision(rev.id)
                      const revs = await getRevisions(selectedJob!.id)
                      setRevisions(revs.data)
                    }}
                    style={{ padding: '8px 12px', background: rev.is_selected ? 'rgba(20,184,166,0.15)' : 'var(--navy-800)', border: `1px solid ${rev.is_selected ? 'var(--teal-500)' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                  >
                    <div style={{ fontWeight: 600 }}>Revision {rev.revision_number} {rev.is_selected && '(Selected)'}</div>
                    <div style={{ color: 'var(--slate-400)', marginTop: 4, fontSize: 11 }}>{rev.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ padding: 16, flex: 1 }}>
            <label className="label">Notes</label>
            <textarea className="input" rows={6}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Add research notes…"
              value={notes} onChange={e => setNotes(e.target.value)} />
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}
              disabled={saving} onClick={handleSaveNotes}>
              {saving ? <div className="spinner" /> : <Save size={13} />}
              Save Notes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 10px', background: 'var(--navy-800)', borderRadius: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-200)',
        fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
    </div>
  )
}

function CaseSkeleton() {
  return (
    <div className="page-body">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />
      ))}
    </div>
  )
}
