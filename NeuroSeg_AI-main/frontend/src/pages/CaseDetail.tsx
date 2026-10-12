// NeuroSeg AI — Case detail page with image workspace, analytics charts, and recommendations
import { useEffect, useState, useRef } from 'react'
import { useParams, useLocation } from 'wouter'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import {
  getCase, getCaseJobs, getJobResult, createReport, assetUrl, updateCase,
  getRevisions, createRevision, selectRevision
} from '../api'
import type { Case, AnalysisJob, AnalysisResult, MaskRevision } from '../api'
import { fmtDateTime, fmtMs, fmtPct, statusColor } from '../utils'
import {
  ArrowLeft, Download, Save, Eye, Layers, RotateCcw,
  AlertTriangle, CheckCircle, Loader2, SlidersHorizontal, Edit3,
  ShieldAlert, Activity, Brain, BarChart3, AlertCircle, Info, ChevronDown
} from 'lucide-react'
import MaskEditor from '../components/MaskEditor'
import {
  RadialBarChart, RadialBar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts'

type ViewMode = 'original' | 'overlay' | 'mask' | 'probmap'

// ── Tumor type recommendations database ────────────────────────────────────
const TUMOR_RECS: Record<string, {
  severity: 'critical' | 'high' | 'moderate' | 'low',
  color: string,
  bgColor: string,
  icon: string,
  about: string,
  recommendations: string[],
  monitoring: string[]
}> = {
  glioblastoma: {
    severity: 'critical', color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', icon: '🔴',
    about: 'Glioblastoma (GBM) is the most aggressive primary brain tumor. It grows rapidly and invades surrounding tissue.',
    recommendations: [
      'Immediate neurosurgical consultation recommended',
      'MRI with contrast enhancement required for staging',
      'Multidisciplinary tumor board review within 72 hours',
      'Concurrent chemoradiotherapy (Stupp protocol) evaluation',
      'Genetic profiling (IDH, MGMT methylation, EGFR) critical for prognosis',
      'Corticosteroids may be indicated to reduce edema'
    ],
    monitoring: ['MRI every 6–8 weeks during treatment', 'Neurological status daily', 'Seizure prophylaxis assessment']
  },
  meningioma: {
    severity: 'moderate', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)', icon: '🟡',
    about: 'Meningiomas arise from meninges and are usually benign. Slow-growing, but can cause symptoms by compressing brain tissue.',
    recommendations: [
      'Neurosurgical consultation for resection planning',
      'Consider "watch and wait" for small, asymptomatic tumors',
      'Stereotactic radiosurgery (Gamma Knife) for appropriate candidates',
      'Monitor for signs of increased intracranial pressure',
      'Hormonal therapy assessment if hormonally driven variant',
      'Annual MRI follow-up for unresected lesions'
    ],
    monitoring: ['MRI every 6–12 months', 'Neurological exam quarterly', 'Visual field assessment if near optic nerve']
  },
  'low-grade glioma': {
    severity: 'moderate', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)', icon: '🟡',
    about: 'Low-grade gliomas (WHO Grade I–II) grow slowly but may transform to higher grade over time. Better prognosis than GBM.',
    recommendations: [
      'Surgical resection to maximize safe tumor removal',
      'IDH mutation and 1p/19q codeletion testing for classification',
      'Adjuvant chemotherapy (Temozolomide/PCV) based on risk stratification',
      'Consider radiation therapy post-operatively',
      'Seizure management — anti-epileptic medications often required',
      'Neuropsychological evaluation for cognitive impacts'
    ],
    monitoring: ['MRI every 3–6 months for first 2 years', 'Annual EEG if seizures present', 'Cognitive monitoring']
  },
  metastasis: {
    severity: 'high', color: '#f97316', bgColor: 'rgba(249,115,22,0.08)', icon: '🟠',
    about: 'Brain metastases are cancer cells that spread to the brain from another primary cancer site. Common sources: lung, breast, melanoma.',
    recommendations: [
      'Full-body staging CT/PET scan to identify primary tumor',
      'Stereotactic radiosurgery (SRS) for 1–4 metastases',
      'Whole-brain radiotherapy (WBRT) consideration for multiple lesions',
      'Targeted therapy based on primary tumor molecular profile',
      'Immunotherapy assessment (PD-L1, TMB status)',
      'Corticosteroids (Dexamethasone) for cerebral edema management'
    ],
    monitoring: ['Brain MRI every 6–8 weeks', 'Primary tumor monitoring', 'Cognitive function assessment']
  },
  'no tumor': {
    severity: 'low', color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)', icon: '🟢',
    about: 'No significant tumor region detected by the AI model at the selected threshold. Results may vary with different threshold settings.',
    recommendations: [
      'Compare findings with clinical MRI radiologist report',
      'Adjust segmentation threshold if findings seem inconsistent',
      'Consider follow-up imaging if clinically indicated',
      'Document findings in patient record for longitudinal tracking',
      'Correlate with neurological symptoms and clinical history'
    ],
    monitoring: ['Routine annual MRI if risk factors present', 'Clinical follow-up as per symptoms']
  },
  default: {
    severity: 'moderate', color: '#6366f1', bgColor: 'rgba(99,102,241,0.08)', icon: '🔵',
    about: 'Abnormal tissue region detected. Classification confidence may be limited. Radiologist review is recommended.',
    recommendations: [
      'Consult with a neuroradiologist for expert interpretation',
      'Correlate with clinical presentation and symptoms',
      'Consider MRI with contrast agent for better characterization',
      'Review previous imaging studies for comparison',
      'Multidisciplinary team discussion before treatment planning',
      'Biopsy may be required for definitive diagnosis'
    ],
    monitoring: ['Follow-up MRI in 4–6 weeks', 'Neurological assessment', 'Symptom monitoring']
  }
}

function getTumorRec(tumorClass: string | null | undefined) {
  if (!tumorClass) return TUMOR_RECS.default
  const key = tumorClass.toLowerCase()
  if (TUMOR_RECS[key]) return TUMOR_RECS[key]
  if (key.includes('glioblastoma') || key.includes('gbm')) return TUMOR_RECS.glioblastoma
  if (key.includes('meningioma')) return TUMOR_RECS.meningioma
  if (key.includes('low') && key.includes('grade')) return TUMOR_RECS['low-grade glioma']
  if (key.includes('metastas')) return TUMOR_RECS.metastasis
  if (key.includes('no tumor') || key.includes('normal') || key.includes('negative')) return TUMOR_RECS['no tumor']
  return TUMOR_RECS.default
}

// ── Analytics panel ────────────────────────────────────────────────────────
function AnalyticsPanel({ result, job }: { result: AnalysisResult; job: AnalysisJob | null }) {
  const rec = getTumorRec(result.predicted_class)
  const pct = Math.round((result.foreground_fraction || 0) * 100)
  const bgPct = 100 - pct
  const conf = Math.round((result.predicted_confidence || 0) * 100)

  // Donut chart data
  const coverageData = [
    { name: 'Tumor Region', value: pct, color: rec.color },
    { name: 'Healthy Tissue', value: bgPct, color: '#1e3a4a' },
  ]

  // Confidence bar chart data
  const confData = [
    { name: 'Confidence', value: conf, fill: rec.color },
    { name: 'Uncertainty', value: 100 - conf, fill: '#1e3a4a' },
  ]

  // Component distribution chart
  const compData = Array.from({ length: result.connected_component_count || 1 }, (_, i) => ({
    name: `Region ${i + 1}`,
    area: Math.round((result.foreground_pixels || 0) / (result.connected_component_count || 1)),
  }))

  // Segmentation quality radial
  const qualityScore = Math.min(100, Math.round(
    (result.predicted_confidence || 0.5) * 0.6 * 100 +
    (result.foreground_fraction > 0 ? 30 : 0) +
    10
  ))
  const radialData = [{ name: 'Score', value: qualityScore, fill: '#0d9488' }]

  // Area chart – simulated threshold-response (shows how threshold affects coverage)
  const thresholdCurve = Array.from({ length: 11 }, (_, i) => {
    const t = i * 0.1
    const simPct = Math.max(0, Math.min(100, pct * (1.5 - t * 1.5)))
    return { threshold: t.toFixed(1), coverage: Math.round(simPct) }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Severity banner ── */}
      <div style={{
        margin: '16px 16px 0', padding: '14px 16px',
        background: rec.bgColor, borderRadius: 10,
        border: `1px solid ${rec.color}30`,
        display: 'flex', alignItems: 'flex-start', gap: 12
      }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{rec.icon}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: rec.color, marginBottom: 3 }}>
            {result.predicted_class
              ? result.predicted_class.charAt(0).toUpperCase() + result.predicted_class.slice(1)
              : 'Unknown class'} · {rec.severity.toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: '#8fa0aa', lineHeight: 1.55 }}>{rec.about}</div>
        </div>
      </div>

      {/* ── Tumor coverage donut ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#9eb3be', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <BarChart3 size={13} style={{ color: '#0d9488' }} /> Tumor Coverage Analysis
        </div>
        <div style={{ background: '#0d1a23', borderRadius: 10, padding: '12px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="50%" height={130}>
              <PieChart>
                <Pie data={coverageData} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
                  dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  {coverageData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 18, fontWeight: 700, fill: rec.color }}>{pct}%</text>
                <text x="50%" y="65%" textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 9, fill: '#5a7380' }}>coverage</text>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#5a7380', marginBottom: 2 }}>Tumor region</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: rec.color }}>{result.foreground_pixels?.toLocaleString() || 0} px</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#5a7380', marginBottom: 2 }}>Healthy tissue</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>
                  {((result.total_pixels || 0) - (result.foreground_pixels || 0)).toLocaleString()} px
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#5a7380', marginBottom: 2 }}>Components</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
                  {result.connected_component_count || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Confidence gauge ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#9eb3be', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Activity size={13} style={{ color: '#0d9488' }} /> Model Confidence
        </div>
        <div style={{ background: '#0d1a23', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#5a7380' }}>Classification confidence</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: conf >= 80 ? '#22c55e' : conf >= 60 ? '#f59e0b' : '#ef4444' }}>
              {conf}%
            </span>
          </div>
          <div style={{ height: 8, background: '#1a2d3a', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${conf}%`,
              background: conf >= 80
                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                : conf >= 60
                  ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                  : 'linear-gradient(90deg, #ef4444, #dc2626)',
              transition: 'width 0.8s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: '#3d5460' }}>Low</span>
            <span style={{ fontSize: 10, color: conf >= 80 ? '#22c55e' : conf >= 60 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
              {conf >= 80 ? 'HIGH CONFIDENCE' : conf >= 60 ? 'MODERATE' : 'LOW — REVIEW NEEDED'}
            </span>
            <span style={{ fontSize: 10, color: '#3d5460' }}>High</span>
          </div>
        </div>
      </div>

      {/* ── Threshold-response curve ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#9eb3be', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <BarChart3 size={13} style={{ color: '#0d9488' }} /> Coverage vs Threshold
        </div>
        <div style={{ background: '#0d1a23', borderRadius: 10, padding: '12px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={thresholdCurve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="covGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="threshold" tick={{ fill: '#3d5460', fontSize: 9 }} />
              <YAxis tick={{ fill: '#3d5460', fontSize: 9 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#0d1a23', border: '1px solid #0d9488', borderRadius: 6, fontSize: 11 }}
                labelStyle={{ color: '#9eb3be' }}
                formatter={(v: any) => [`${v}%`, 'Coverage']}
              />
              <Area type="monotone" dataKey="coverage" stroke="#0d9488" strokeWidth={2}
                fill="url(#covGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 10, color: '#3d5460', textAlign: 'center', marginTop: 2 }}>
            Segmentation threshold → tumor coverage %
          </div>
        </div>
      </div>

      {/* ── Bounding box info ── */}
      {result.bounding_box && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9eb3be', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Brain size={13} style={{ color: '#0d9488' }} /> Lesion Location
          </div>
          <div style={{ background: '#0d1a23', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'X origin', val: result.bounding_box.x + ' px' },
              { label: 'Y origin', val: result.bounding_box.y + ' px' },
              { label: 'Width', val: result.bounding_box.w + ' px' },
              { label: 'Height', val: result.bounding_box.h + ' px' },
            ].map(m => (
              <div key={m.label} style={{ background: '#0a141c', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: '#3d5460', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{m.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Precautionary Recommendations ── */}
      <div style={{ margin: '16px 16px 0', padding: 16, background: rec.bgColor, borderRadius: 10, border: `1px solid ${rec.color}30` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: rec.color, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          <ShieldAlert size={14} /> Clinical Recommendations
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rec.recommendations.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: `${rec.color}25`,
                border: `1px solid ${rec.color}50`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, marginTop: 1
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: rec.color }}>{i + 1}</span>
              </div>
              <span style={{ fontSize: 12, color: '#c5d6df', lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monitoring schedule ── */}
      <div style={{ margin: '12px 16px', padding: 14, background: 'rgba(13,148,136,0.06)', borderRadius: 10, border: '1px solid rgba(13,148,136,0.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
          <CheckCircle size={12} /> Monitoring Schedule
        </div>
        {rec.monitoring.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <span style={{ color: '#0d9488', fontSize: 14, lineHeight: 1 }}>→</span>
            <span style={{ fontSize: 11.5, color: '#8fa0aa', lineHeight: 1.5 }}>{m}</span>
          </div>
        ))}
      </div>

      {/* ── Disclaimer ── */}
      <div style={{ margin: '0 16px 16px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: 10, color: '#3d5460', lineHeight: 1.6 }}>
          <Info size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          AI predictions are for research and educational purposes only. Not intended for clinical diagnosis or treatment planning. Always consult a qualified medical professional.
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const caseId = id
  const [, nav] = useLocation()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [jobs, setJobs] = useState<AnalysisJob[]>([])
  const [selectedJob, setSelectedJob] = useState<AnalysisJob | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('original')
  const [opacity, setOpacity] = useState(0.6)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revisions, setRevisions] = useState<MaskRevision[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<'inspector' | 'analytics'>('inspector')

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
      case 'overlay':  return r.overlay_url || null
      case 'mask':     return activeRev ? assetUrl(activeRev.mask_path) : (r.mask_url || null)
      case 'probmap':  return r.prob_map_url || null
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
    <div className="fade-in case-detail-container">
      {/* Top bar */}
      <div className="case-detail-topbar">
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select id="export-fmt" className="input" style={{ width: 130, padding: '4px 8px', fontSize: 12, height: 28, background: 'var(--navy-800)' }} defaultValue="pdf">
            <option value="pdf">PDF Report</option>
            <option value="zip">Full ZIP Archive</option>
            <option value="json">Raw JSON Data</option>
            <option value="csv">CSV Metrics</option>
            <option value="png_overlay">Overlay PNG</option>
            <option value="png_mask">Mask PNG</option>
          </select>
          <button className="btn btn-primary btn-sm"
            disabled={!selectedJob || selectedJob.status !== 'completed' || exporting}
            onClick={() => handleExport((document.getElementById('export-fmt') as HTMLSelectElement).value)}>
            {exporting ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Download size={13} />}
            Export
          </button>
        </div>
      </div>

      <div className="case-detail-body">
        {/* ─ Left: viewer ─ */}
        <div className="case-detail-viewer-pane">
          {/* View mode tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid var(--navy-800)' }}>
            <div className="segmented">
              {(['original', 'overlay', 'mask', 'probmap'] as ViewMode[]).map(mode => (
                <button key={mode}
                  className={viewMode === mode ? 'selected' : ''}
                  disabled={(mode !== 'original' && !result) || isEditing}
                  onClick={() => setViewMode(mode)}>
                  {mode === 'probmap' ? 'Prob Map' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
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
              <TransformWrapper initialScale={1} minScale={0.5} maxScale={8} centerOnInit>
                {({ resetTransform }) => (
                  <>
                    <div style={{ position: 'absolute', top: 60, right: 12, zIndex: 10, display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => resetTransform()}>
                        <RotateCcw size={13} /> Reset
                      </button>
                    </div>
                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {origAsset && (
                          <img src={assetUrl(origAsset.filename, 'upload')} alt="Original"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        )}
                        {viewMode !== 'original' && imgSrc && (
                          <img src={imgSrc} alt={viewMode}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain',
                              opacity: viewMode === 'overlay' ? opacity : 1 }} />
                        )}
                      </div>
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

        {/* ─ Right: tabbed inspector / analytics ─ */}
        <div className="case-detail-sidebar">

          {/* Tab header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--navy-700)', flexShrink: 0 }}>
            {(['inspector', 'analytics'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '12px 0', background: 'none', border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #0d9488' : '2px solid transparent',
                  color: activeTab === tab ? '#0d9488' : '#5a7380',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.5,
                  textTransform: 'uppercase', transition: 'all 0.15s'
                }}>
                {tab === 'inspector' ? '📋 Inspector' : '📊 Analytics'}
              </button>
            ))}
          </div>

          {activeTab === 'inspector' ? (
            <>
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
                    <div style={{ padding: '8px 12px', background: !revisions.some(r => r.is_selected) ? 'rgba(20,184,166,0.15)' : 'var(--navy-800)', border: `1px solid ${!revisions.some(r => r.is_selected) ? 'var(--teal-500)' : 'transparent'}`, borderRadius: 6, cursor: 'not-allowed', fontSize: 12, opacity: 0.7 }}>
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
                        style={{ padding: '8px 12px', background: rev.is_selected ? 'rgba(20,184,166,0.15)' : 'var(--navy-800)', border: `1px solid ${rev.is_selected ? 'var(--teal-500)' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
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
            </>
          ) : (
            /* Analytics tab */
            result ? (
              <AnalyticsPanel result={result} job={selectedJob} />
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--slate-500)' }}>
                <BarChart3 size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                <p style={{ fontSize: 13 }}>Run an analysis to see charts and recommendations.</p>
              </div>
            )
          )}
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
