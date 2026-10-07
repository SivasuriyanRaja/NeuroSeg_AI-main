// NeuroSeg AI — Experiments & Models page
import { useEffect, useState } from 'react'
import { getExperiments, getModels } from '../api'
import type { ExperimentRun, ModelVersion } from '../api'
import { fmtDateTime } from '../utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { FlaskConical, Brain, TrendingUp, BarChart3 } from 'lucide-react'

export default function Experiments() {
  const [runs, setRuns] = useState<ExperimentRun[]>([])
  const [models, setModels] = useState<ModelVersion[]>([])
  const [selected, setSelected] = useState<ExperimentRun | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getExperiments(), getModels()])
      .then(([runRes, modelRes]) => {
        setRuns(runRes.data)
        setModels(modelRes.data)
        if (runRes.data.length) setSelected(runRes.data[0])
      })
      .finally(() => setLoading(false))
  }, [])

  const chartData = selected
    ? Object.entries(selected.training_curves)
        .map(([epoch, v]) => ({ epoch: Number(epoch), ...v }))
        .sort((a, b) => a.epoch - b.epoch)
    : []

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Experiments & Models</h1>
          <p className="page-sub">Training history, metrics and model comparisons</p>
        </div>
      </div>

      <div className="page-body">
        {/* Models */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Brain size={18} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Registered Models</span>
          </div>
          {models.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <p>No models registered. Run <code>python init_db.py</code> in the backend directory.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Architecture</th>
                    <th>Version</th>
                    <th>Input Size</th>
                    <th>Threshold</th>
                    <th>Parameters</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td><code style={{ fontSize: 11 }}>{m.architecture}</code></td>
                      <td>{m.version_tag}</td>
                      <td>{m.input_size}×{m.input_size}</td>
                      <td>{m.threshold}</td>
                      <td style={{ color: 'var(--slate-400)' }}>
                        {m.parameter_count ? m.parameter_count.toLocaleString() : '—'}
                      </td>
                      <td>
                        <span className={`badge ${m.is_active && m.checkpoint_path ? 'badge-completed' : 'badge-queued'}`}>
                          {m.checkpoint_path ? 'Loaded' : 'No checkpoint'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Experiment runs */}
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Run list */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <FlaskConical size={18} style={{ color: 'var(--teal-400)' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Training Runs</span>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 60 }} />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-icon"><FlaskConical size={24} /></div>
                <p>No training runs yet.</p>
                <p style={{ fontSize: 12 }}>Run <code>python ml/train.py --config ml/configs/unet_baseline.yaml</code></p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {runs.map(run => (
                  <div key={run.id}
                    onClick={() => setSelected(run)}
                    style={{
                      padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                      background: selected?.id === run.id ? 'rgba(20,184,166,0.1)' : 'var(--navy-900)',
                      border: `1px solid ${selected?.id === run.id ? 'rgba(20,184,166,0.3)' : 'var(--navy-700)'}`,
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{run.run_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4 }}>
                      {run.dataset_name} · {fmtDateTime(run.created_at)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--teal-400)', marginTop: 2 }}>
                      Val Dice: {run.best_val_dice.toFixed(4)} · Epochs: {run.epochs_trained}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected run detail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selected ? (
              <>
                {/* Training curves */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <TrendingUp size={18} style={{ color: 'var(--teal-400)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Training Curves — {selected.run_name}</span>
                  </div>
                  {chartData.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--slate-500)', padding: 24 }}>
                      No curve data recorded for this run.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="epoch" tick={{ fill: '#64748B', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--navy-800)', border: '1px solid var(--navy-600)', borderRadius: 8 }}
                          labelStyle={{ color: 'var(--slate-300)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="train_loss" stroke="#3B82F6" strokeWidth={2} dot={false} name="Train Loss" />
                        <Line type="monotone" dataKey="val_loss" stroke="#F59E0B" strokeWidth={2} dot={false} name="Val Loss" />
                        <Line type="monotone" dataKey="val_dice" stroke="#14B8A6" strokeWidth={2} dot={false} name="Val Dice" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Metrics table */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <BarChart3 size={18} style={{ color: 'var(--teal-400)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Test Metrics</span>
                  </div>
                  <div className="grid-2" style={{ gap: 8 }}>
                    <MetricBadge label="Dice" val={selected.test_dice} />
                    <MetricBadge label="IoU" val={selected.test_iou} />
                    <MetricBadge label="Precision" val={selected.test_precision} />
                    <MetricBadge label="Recall" val={selected.test_recall} />
                  </div>
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <InfoRow label="Parameters" val={selected.parameter_count?.toLocaleString() ?? '—'} />
                    <InfoRow label="Median latency" val={selected.median_latency_ms ? `${selected.median_latency_ms} ms` : '—'} />
                    <InfoRow label="p95 latency" val={selected.p95_latency_ms ? `${selected.p95_latency_ms} ms` : '—'} />
                    <InfoRow label="Peak memory" val={selected.peak_memory_mb ? `${selected.peak_memory_mb} MB` : '—'} />
                    <InfoRow label="Hardware" val={selected.hardware_info || '—'} />
                    <InfoRow label="Best epoch" val={String(selected.best_epoch)} />
                  </div>
                  <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(245,158,11,0.07)',
                    borderRadius: 6, fontSize: 11, color: 'rgba(245,158,11,0.8)' }}>
                    ⚠ Results are on a test set. Clinical performance requires independent external evaluation.
                  </div>
                </div>
              </>
            ) : (
              <div className="card">
                <div className="empty-state" style={{ padding: 32 }}>
                  <div className="empty-icon"><FlaskConical size={24} /></div>
                  <p>Select a run to inspect metrics and curves.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricBadge({ label, val }: { label: string; val: number | null }) {
  return (
    <div style={{ background: 'var(--navy-900)', borderRadius: 8, padding: '10px 14px',
      textAlign: 'center', border: '1px solid var(--navy-700)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal-400)',
        fontFamily: 'JetBrains Mono, monospace' }}>
        {val != null ? val.toFixed(4) : '—'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2, textTransform: 'uppercase',
        letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function InfoRow({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ padding: '6px 10px', background: 'var(--navy-900)', borderRadius: 6,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-300)',
        fontFamily: 'JetBrains Mono, monospace' }}>{val}</span>
    </div>
  )
}
