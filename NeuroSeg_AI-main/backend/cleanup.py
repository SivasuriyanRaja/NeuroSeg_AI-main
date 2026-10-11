from app.database import init_db
from app.models import Case, Asset, AnalysisJob, AnalysisResult, MaskRevision, Report, User, ExperimentRun
from app.config import settings
import shutil

def clear_db():
    print("Clearing MongoDB collections...")
    init_db()
    Case.objects.delete()
    Asset.objects.delete()
    AnalysisJob.objects.delete()
    AnalysisResult.objects.delete()
    MaskRevision.objects.delete()
    Report.objects.delete()
    User.objects.delete()
    ExperimentRun.objects.delete()
    print("MongoDB collections cleared.")

def clear_files():
    print("Clearing local uploads and results directories...")
    if settings.upload_dir.exists():
        shutil.rmtree(settings.upload_dir)
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
    if settings.results_dir.exists():
        shutil.rmtree(settings.results_dir)
        settings.results_dir.mkdir(parents=True, exist_ok=True)
    print("Local files cleared.")

if __name__ == "__main__":
    clear_db()
    clear_files()
