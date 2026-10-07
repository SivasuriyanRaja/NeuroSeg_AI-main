# Architecture & Database Schema

## System Architecture

NeuroSeg AI operates as a decoupled, local-first system consisting of three main layers:

```mermaid
graph TD
    subgraph Frontend [Frontend: React + Vite]
        UI[React UI]
        API_Client[Axios API Client]
        UI --> API_Client
    end

    subgraph Backend [Backend: FastAPI]
        API[FastAPI Server]
        Worker[Analysis Worker Process]
        DB[(SQLite DB)]
        
        API_Client -->|HTTP REST| API
        API -->|Read/Write| DB
        Worker <-->|Poll/Update| DB
    end

    subgraph FileSystem [File System]
        Models[Model Weights]
        Images[Uploaded MRIs]
        Results[Generated Masks & Overlays]
        
        API -->|Read/Write| Images
        API -->|Read| Results
        Worker -->|Read| Images
        Worker -->|Read| Models
        Worker -->|Write| Results
    end

    subgraph ML [Machine Learning: PyTorch]
        Inference[Inference Engine]
        Worker -->|Loads & Calls| Inference
    end
```

### Components:
1. **Frontend**: A React single-page application communicating via REST. Uses local proxy to avoid CORS issues in development.
2. **FastAPI API**: Handles all HTTP requests, image validation, case management, and enqueues jobs by writing to the database.
3. **Background Worker**: A standalone Python process that polls the database for queued jobs. It claims a job atomically (using `FOR UPDATE SKIP LOCKED` equivalent logic logic adapted for SQLite/application layer), runs PyTorch inference, and writes results to disk and DB.
4. **Local File System**: `data/` directory stores raw images, model checkpoints, and result artifacts. 

---

## Database Schema

```mermaid
erDiagram
    Case ||--o{ Asset : contains
    Case ||--o{ AnalysisJob : spawns
    ModelVersion ||--o{ AnalysisJob : runs
    ModelVersion ||--o{ ExperimentRun : tracks
    AnalysisJob ||--o| AnalysisResult : yields
    AnalysisResult ||--o{ MaskRevision : has
    AnalysisResult ||--o{ Report : generates

    Case {
        string id PK
        string label
        text notes
        datetime created_at
    }
    
    Asset {
        string id PK
        string case_id FK
        string asset_type
        string filename
        int file_size_bytes
    }
    
    ModelVersion {
        string id PK
        string name
        string architecture
        string version_tag
        string checkpoint_path
        boolean is_active
    }
    
    AnalysisJob {
        string id PK
        string case_id FK
        string model_version_id FK
        string status
        float threshold
        int processing_ms
    }
    
    AnalysisResult {
        string id PK
        string job_id FK
        int foreground_pixels
        float foreground_fraction
        int connected_component_count
    }
    
    MaskRevision {
        string id PK
        string result_id FK
        int revision_number
        boolean is_selected
    }
    
    Report {
        string id PK
        string result_id FK
        string format
        string file_path
    }
    
    ExperimentRun {
        string id PK
        string model_version_id FK
        string run_name
        float best_val_dice
        float test_dice
    }
```
