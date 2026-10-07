// NeuroSeg AI — Settings page
import { useEffect, useState } from 'react'
import { getStorage } from '../api'
import type { StorageStats } from '../api'
import { Settings as SettingsIcon, HardDrive, Cpu, Brain, Info } from 'lucide-react'

export default function SettingsPage() {
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [hasCuda, setHasCuda] = useState<boolean | null>(null)

  useEffect(() => {
    getStorage().then(r => setStorage(r.data))
    // Probe CUDA via health endpoint (optional)
    fetch('/api/health').then(r => r.json()).then(d => {
      setHasCuda(d.cuda_available ?? false)
    }).catch(() => {})
  }, [])

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Local storage, device status and model configuration</p>
        </div>
      </div>

      <div className="page-body">
        {/* Disclaimer */}
        <div className="disclaimer">
          <Info size={14} />
          NeuroSeg AI is a single-user local workspace. No patient identifiers are logged.
          All files remain on your machine.
        </div>

        {/* Storage */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <HardDrive size={18} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Local Storage</span>
          </div>
          {storage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StorageRow label="Uploads" path={storage.upload_dir} mb={storage.upload_size_mb} />
              <StorageRow label="Results" path={storage.results_dir} mb={storage.results_size_mb} />
              <StorageRow label="Models" path={storage.model_dir} mb={storage.model_size_mb} />
            </div>
          ) : (
            <div className="skeleton" style={{ height: 80 }} />
          )}
        </div>

        {/* Device */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Cpu size={18} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Compute Device</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <DeviceBadge label="CPU" available description="Always available. Used for inference by default." />
            <DeviceBadge label="CUDA GPU" available={hasCuda === true}
              description="Optional. Speeds up training and inference when a compatible NVIDIA GPU is available." />
          </div>
          <p style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 12 }}>
            Mixed-precision CUDA training is enabled automatically when CUDA is available.
            CPU inference works on all machines.
          </p>
        </div>

        {/* Model setup */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Brain size={18} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Model Setup</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SetupStep
              done={false}
              label="Prepare training dataset"
              desc="Collect paired image/mask directories or a COCO JSON annotation file. See docs/methodology.md for dataset requirements."
            />
            <SetupStep
              done={false}
              label="Run training CLI"
              desc="python ml/train.py --config ml/configs/unet_baseline.yaml"
              code
            />
            <SetupStep
              done={false}
              label="Register checkpoint in database"
              desc="Update the ModelVersion row's checkpoint_path after training completes."
            />
            <SetupStep
              done={false}
              label="Start analysis worker"
              desc="python -m app.worker   (in a separate terminal with the venv active)"
              code
            />
          </div>
        </div>

        {/* Retention */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <SettingsIcon size={18} style={{ color: 'var(--teal-400)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Data Retention</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--slate-400)', lineHeight: 1.7 }}>
            Cases and results are stored indefinitely until manually deleted. Delete a case from
            the Cases page to remove all associated files from disk. The original uploaded image
            is never modified by the analysis pipeline.
          </p>
        </div>
      </div>
    </div>
  )
}

function StorageRow({ label, path, mb }: { label: string; path: string; mb: number }) {
  const pct = Math.min(100, (mb / 1000) * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>{mb.toFixed(1)} MB</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <code style={{ fontSize: 10, color: 'var(--slate-600)' }}>{path}</code>
    </div>
  )
}

function DeviceBadge({ label, available, description }: {
  label: string; available: boolean | null; description: string
}) {
  return (
    <div style={{ flex: 1, padding: '14px 16px', borderRadius: 10,
      background: available ? 'rgba(16,185,129,0.08)' : 'var(--navy-900)',
      border: `1px solid ${available ? 'rgba(16,185,129,0.25)' : 'var(--navy-700)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%',
          background: available === null ? 'var(--slate-500)' : available ? 'var(--success)' : 'var(--slate-600)' }} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
        <span style={{ fontSize: 11, color: available ? 'var(--success)' : 'var(--slate-500)' }}>
          {available === null ? 'Checking…' : available ? 'Available' : 'Not detected'}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--slate-500)', lineHeight: 1.5, margin: 0 }}>{description}</p>
    </div>
  )
}

function SetupStep({ done, label, desc, code }: {
  done: boolean; label: string; desc: string; code?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2,
        background: done ? 'var(--success)' : 'var(--navy-700)',
        color: done ? 'white' : 'var(--slate-500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
        {done ? '✓' : '○'}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{label}</div>
        {code
          ? <code style={{ fontSize: 11, color: 'var(--teal-400)', background: 'var(--navy-900)',
              padding: '3px 8px', borderRadius: 4, display: 'inline-block' }}>{desc}</code>
          : <p style={{ fontSize: 12, color: 'var(--slate-500)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
        }
      </div>
    </div>
  )
}
