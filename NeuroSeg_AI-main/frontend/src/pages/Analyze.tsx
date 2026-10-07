// NeuroSeg AI — Analyze page: upload + run inference
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, ImageIcon, Brain, ChevronDown, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { getModels, submitAnalysis } from '../api'
import type { ModelVersion, AnalysisJob } from '../api'
import { useJobPoller, statusColor } from '../utils'
import api from '../api'

export default function Analyze() {
  const [models, setModels] = useState<ModelVersion[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [threshold, setThreshold] = useState(0.5)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    getModels().then(r => {
      setModels(r.data)
      if (r.data.length) setSelectedModel(r.data[0].id)
    })
  }, [])

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError(null)
    setCaseId(null)
    setJobId(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({ onDrop, accept: { 'image/png': [], 'image/jpeg': [] }, maxFiles: 1 })

  const handleUploadAndAnalyze = async () => {
    if (!file || !selectedModel) return
    setUploading(true)
    setError(null)
    try {
      // 1. Upload → create case
      const fd = new FormData()
      fd.append('file', file)
      fd.append('label', label || file.name)
      const caseRes = await api.post('/cases/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const newCaseId = caseRes.data.id
      setCaseId(newCaseId)

      // 2. Submit analysis job → 202
      const jobRes = await submitAnalysis(newCaseId, selectedModel, threshold)
      setJobId(jobRes.data.id)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Upload failed. Check API connection.')
    } finally {
      setUploading(false)
    }
  }

  // Poll job until complete
  const { job } = useJobPoller(
    jobId,
    (completedJob) => { nav(`/cases/${completedJob.case_id}`) },
    () => setError('Analysis job failed. Check worker logs.')
  )

  const isRunning = job && (job.status === 'queued' || job.status === 'running')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analyze MRI</h1>
          <p className="page-sub">Upload a 2D brain MRI and run segmentation inference</p>
        </div>
      </div>

      <div className="page-body">
        <div className="disclaimer">
          <AlertCircle size={14} />
          User-provided MRI images only. AI predictions are not clinically validated.
          For research and education only.
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Left: upload + config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Drop zone */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--navy-700)' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>MRI Image Upload</span>
              </div>
              <div style={{ padding: 20 }}>
                <div
                  {...getRootProps()}
                  className={`dropzone${isDragActive ? ' active' : ''}${isDragReject ? ' reject' : ''}`}
                >
                  <input {...getInputProps()} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14,
                      background: 'var(--navy-700)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: 'var(--teal-400)'
                    }}>
                      <Upload size={26} />
                    </div>
                    {isDragActive
                      ? <p style={{ color: 'var(--teal-400)', fontWeight: 600 }}>Drop your MRI image here</p>
                      : <>
                          <p style={{ color: 'var(--slate-300)', fontWeight: 500 }}>
                            Drag & drop a PNG or JPEG MRI image
                          </p>
                          <p style={{ color: 'var(--slate-500)', fontSize: 12 }}>
                            Max 50 MB · up to 4096×4096 px
                          </p>
                          <button className="btn btn-secondary btn-sm">Browse files</button>
                        </>
                    }
                    {isDragReject && (
                      <p style={{ color: 'var(--error)', fontSize: 12 }}>Only PNG/JPEG files allowed.</p>
                    )}
                  </div>
                </div>

                {file && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--navy-900)', borderRadius: 8, padding: '10px 14px' }}>
                    <ImageIcon size={16} style={{ color: 'var(--teal-400)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--slate-500)' }}>
                        {(file.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Config */}
            <div className="card">
              <span style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 16 }}>
                Configuration
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Case Label</label>
                  <input className="input" placeholder="e.g. Patient scan 001"
                    value={label} onChange={e => setLabel(e.target.value)} />
                </div>

                <div>
                  <label className="label">Model</label>
                  <div style={{ position: 'relative' }}>
                    <select className="input" style={{ appearance: 'none', paddingRight: 32 }}
                      value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                      {models.length === 0
                        ? <option value="">No models available — run training CLI first</option>
                        : models.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.architecture}) · v{m.version_tag}
                            </option>
                          ))
                      }
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }} />
                  </div>
                  {selectedModel && models.find(m => m.id === selectedModel)?.checkpoint_path == null && (
                    <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 6 }}>
                      ⚠ No checkpoint found. Run inference will use random weights (demo only).
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">
                    Decision Threshold — {threshold.toFixed(2)}
                  </label>
                  <input type="range" className="slider" style={{ width: '100%' }}
                    min={0} max={1} step={0.01}
                    value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                    <span>0.0 (more foreground)</span>
                    <span>1.0 (less foreground)</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
                <span style={{ color: 'var(--error)', fontSize: 13 }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              className="btn btn-primary btn-lg"
              disabled={!file || !selectedModel || uploading || !!isRunning}
              onClick={handleUploadAndAnalyze}
              style={{ width: '100%' }}
            >
              {uploading ? <><div className="spinner" /> Uploading…</>
                : isRunning ? <><div className="spinner" /> Analyzing ({job?.status})…</>
                : <><Brain size={18} /> Analyze MRI</>
              }
            </button>

            {job && (
              <JobStatusCard job={job} />
            )}
          </div>

          {/* Right: image preview */}
          <div className="card viewer-canvas" style={{ minHeight: 400, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 0, background: '#000' }}>
            {preview ? (
              <img src={preview} alt="MRI preview"
                style={{ maxWidth: '100%', maxHeight: 520, objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 16, color: 'var(--slate-600)', padding: 40 }}>
                <div style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--navy-800)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={34} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 500, color: 'var(--slate-500)' }}>No image selected</p>
                  <p style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 4 }}>
                    Upload a brain MRI to preview it here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function JobStatusCard({ job }: { job: AnalysisJob }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {job.status === 'queued' || job.status === 'running'
        ? <Loader2 size={20} style={{ color: 'var(--info)', animation: 'spin 1s linear infinite' }} />
        : job.status === 'completed'
          ? <CheckCircle size={20} style={{ color: 'var(--success)' }} />
          : <AlertCircle size={20} style={{ color: 'var(--error)' }} />
      }
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          Job <code style={{ fontSize: 11 }}>{job.id.slice(0, 8)}</code>
        </div>
        <div style={{ fontSize: 12, color: 'var(--slate-500)' }}>
          Status: <span className={`badge ${statusColor[job.status]}`}>{job.status}</span>
          {job.processing_ms && ` · ${job.processing_ms} ms`}
        </div>
      </div>
    </div>
  )
}
