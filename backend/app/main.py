# Application entry: initialize storage, register API routes, and expose service health.
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, ensure_schema
from app.models import models  # Register SQLAlchemy tables before initialization.
from app.api import auth, builtin, data
from app.services import builtin as builtin_data

os.makedirs(settings.upload_dir, exist_ok=True)
Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(
    title="GramVision API",
    description="District and village data analysis workspace",
    version="3.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([settings.frontend_url, "http://localhost:5173", "http://127.0.0.1:5173"])),
    # Vite moves to the next free port when 5173 is taken, so any loopback port is
    # accepted. This server is only ever meant to listen on your own machine.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(data.router)
app.include_router(builtin.router)


@app.get("/api/health")
def health():
    """Reports whether the bundled dataset is in place, so setup problems surface early."""
    available = []
    for slug in builtin_data.BUILTIN_SOURCES:
        available.append({"slug": slug, "present": builtin_data.file_path(slug).exists()})
    return {"status": "ok", "service": "GramVision", "builtin_datasets": available}
