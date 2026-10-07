# API Documentation

The NeuroSeg AI backend exposes a REST API via FastAPI. 
Interactive documentation (Swagger UI) is automatically available at `http://localhost:8000/api/docs` when the backend is running.

## Base URL
`/api`

## Endpoints Summary

### Cases (`/api/cases/`)
- `POST /`: Create a new case. Accepts `multipart/form-data` with `file` (MRI image), `label`, and `notes`. Returns the created `Case`.
- `GET /`: List cases. Supports pagination (`skip`, `limit`) and `search`.
- `GET /{case_id}`: Retrieve full case details including all associated assets (images).
- `PATCH /{case_id}`: Update case `label` or `notes`.
- `DELETE /{case_id}`: Delete a case, cascade deletes jobs, results, and local files.

### Jobs (`/api/jobs/`)
- `POST /{case_id}/submit`: Submits an MRI for analysis. Requires `model_version_id` and `threshold`. Returns `202 Accepted` with a Job ID.
- `GET /{job_id}`: Poll job status (`queued`, `running`, `completed`, `failed`).
- `GET /case/{case_id}`: List all jobs for a specific case.
- `GET /{job_id}/result`: Retrieves the `AnalysisResult` (metrics, file paths) for a completed job.
- `GET /{job_id}/revisions`: List user-edited mask revisions.

### Assets & Reports (`/api/assets/` and `/api/reports/`)
- `GET /assets/{filename}?type={upload|result}`: Serves static images and overlays safely.
- `POST /jobs/{job_id}/report`: Generate a report (PDF, JSON, CSV, PNGs, ZIP).
- `GET /reports/{report_id}/download`: Download the generated report.

### Models & Experiments (`/api/models/`, `/api/experiments/`)
- `GET /models/`: List active registered models.
- `GET /models/{model_id}`: Get model details.
- `GET /experiments/`: List training runs.
- `GET /experiments/{run_id}`: Retrieve training curves and metrics.

### System (`/api/dashboard/`, `/api/settings/`, `/api/health`)
- `GET /dashboard/`: Returns aggregate statistics for the UI.
- `GET /settings/storage`: Returns disk space usage across data directories.
- `GET /health`: Basic ping endpoint.
