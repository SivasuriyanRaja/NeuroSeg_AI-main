// NeuroSeg AI — Shared utility hooks and helpers
import { useState, useCallback, useEffect, useRef } from 'react'
import { getJob } from './api'
import type { AnalysisJob } from './api'

// ─── Job polling hook ─────────────────────────────────────────────────────────
export function useJobPoller(
  jobId: string | null,
  onComplete?: (job: AnalysisJob) => void,
  onFailed?: (job: AnalysisJob) => void,
  intervalMs = 2000
) {
  const [job, setJob] = useState<AnalysisJob | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => {
    if (!jobId) return
    const poll = async () => {
      try {
        const res = await getJob(jobId)
        setJob(res.data)
        if (res.data.status === 'completed') { stop(); onComplete?.(res.data) }
        if (res.data.status === 'failed')    { stop(); onFailed?.(res.data) }
      } catch { /* swallow poll errors */ }
    }
    poll()
    timerRef.current = setInterval(poll, intervalMs)
    return stop
  }, [jobId, intervalMs, stop, onComplete, onFailed])

  return { job, stop }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit' })

export const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`

export const fmtMs = (ms: number | null) => ms != null ? `${ms} ms` : '—'

export const statusColor: Record<string, string> = {
  queued:    'badge-queued',
  running:   'badge-running',
  completed: 'badge-completed',
  failed:    'badge-failed',
}

// ─── Clamp ────────────────────────────────────────────────────────────────────
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
