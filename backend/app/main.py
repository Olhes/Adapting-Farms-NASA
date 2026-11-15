from fastapi import FastAPI
from pathlib import Path

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.modules.climate.controller import router as climate_router
from app.modules.parcels.controller import router as parcels_router
from app.modules.rotations.controller import router as rotations_router
from app.modules.simulation.controller import router as simulation_router

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend modular del asesor de rotación de cultivos Field Shift (Arequipa).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parcels_router)
app.include_router(rotations_router)
app.include_router(climate_router)
app.include_router(simulation_router)


# Serve the frontend from the same origin: http://localhost:8765/app/
_FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
if _FRONTEND.is_dir():
    app.mount("/app", StaticFiles(directory=_FRONTEND, html=True), name="frontend")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}
