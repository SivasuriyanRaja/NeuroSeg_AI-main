// NeuroSeg AI — API client
import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModelVersion {
  id: string
  name: string
  architecture: string
  checkpoint_path: string | null
  version_tag: string
  input_size: number
  threshold: number
  parameter_count: number | null
  weight_file_size_bytes: number | null
  description: string
  dataset_provenance: string
  is_active: boolean
  created_at: string
}

export interface Asset {
  id: string
  asset_type: string
  filename: string
  original_filename: string
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  created_at: string
}

export interface Case {
  id: string
  label: string
  notes: string
  created_at: string
  updated_at: string
  assets: Asset[]
}

export interface CaseListItem {
  id: string
  label: string
  created_at: string
  updated_at: string
  job_status: string | null
  thumbnail_url: string | null
}

export interface AnalysisJob {
  id: string
  case_id: string
  model_version_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  threshold: number
  retry_count: number
  error_message: string | null
  queued_at: string
  started_at: string | null
  completed_at: string | null
  processing_ms: number | null
}

export interface BoundingBox {
  x: number; y: number; w: number; h: number
}

export interface AnalysisResult {
  id: string
  job_id: string
  foreground_pixels: number
  total_pixels: number
  foreground_fraction: number
  bounding_box: BoundingBox | null
  connected_component_count: number
  predicted_class?: string
  predicted_confidence?: number
  preprocessing_meta: Record<string, unknown>
  created_at: string
}

export interface MaskRevision {
  id: string
  result_id: string
  revision_number: number
  mask_path: string
  notes: string
  is_selected: boolean
  created_at: string
}

export interface Report {
  id: string
  result_id: string
  format: string
  file_size_bytes: number
  created_at: string
}

export interface ExperimentRun {
  id: string
  model_version_id: string
  run_name: string
  dataset_name: string
  epochs_trained: number
  best_epoch: number
  best_val_dice: number
  test_dice: number | null
  test_iou: number | null
  test_precision: number | null
  test_recall: number | null
  parameter_count: number | null
  peak_memory_mb: number | null
  median_latency_ms: number | null
  p95_latency_ms: number | null
  hardware_info: string
  training_curves: Record<string, { train_loss: number; val_loss: number; val_dice: number }>
  config_snapshot: Record<string, unknown>
  created_at: string
}

export interface DashboardStats {
  total_cases: number
  completed_analyses: number
  running_jobs: number
  queued_jobs: number
  failed_jobs: number
  active_model: ModelVersion | null
  recent_jobs: AnalysisJob[]
}

export interface StorageStats {
  upload_dir: string
  results_dir: string
  model_dir: string
  upload_size_mb: number
  results_size_mb: number
  model_size_mb: number
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const getCases = (skip = 0, limit = 20, search?: string) =>
  api.get<CaseListItem[]>('/cases/', { params: { skip, limit, search } })

export const getCase = (id: string) =>
  api.get<Case>(`/cases/${id}`)

export const updateCase = (id: string, data: { label?: string; notes?: string }) =>
  api.patch<Case>(`/cases/${id}`, data)

export const deleteCase = (id: string) =>
  api.delete(`/cases/${id}`)

export const submitAnalysis = (caseId: string, modelVersionId: string, threshold = 0.5) =>
  api.post<AnalysisJob>(`/jobs/${caseId}/submit`, { model_version_id: modelVersionId, threshold })

export const getJob = (jobId: string) =>
  api.get<AnalysisJob>(`/jobs/${jobId}`)

export const getCaseJobs = (caseId: string) =>
  api.get<AnalysisJob[]>(`/jobs/case/${caseId}`)

export const getJobResult = (jobId: string) =>
  api.get<AnalysisResult>(`/jobs/${jobId}/result`)

export const getModels = () =>
  api.get<ModelVersion[]>('/models/')

export const getExperiments = () =>
  api.get<ExperimentRun[]>('/experiments/')

export const getDashboard = () =>
  api.get<DashboardStats>('/dashboard/')

export const getStorage = () =>
  api.get<StorageStats>('/settings/storage')

export const createReport = (jobId: string, format: string) =>
  api.post<Report>(`/jobs/${jobId}/report`, { format })

export const assetUrl = (filename: string, type: 'upload' | 'result' = 'result') =>
  `/api/assets/${filename}?type=${type}`

export const getRevisions = (jobId: string) =>
  api.get<MaskRevision[]>(`/jobs/${jobId}/revisions`)

export const createRevision = (jobId: string, file: Blob, notes: string, baseRevisionNumber: number) => {
  const fd = new FormData()
  fd.append('file', file, 'mask.png')
  fd.append('notes', notes)
  fd.append('base_revision_number', baseRevisionNumber.toString())
  return api.post<MaskRevision>(`/jobs/${jobId}/revisions`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const selectRevision = (revisionId: string) =>
  api.patch<MaskRevision>(`/revisions/${revisionId}/select`)
