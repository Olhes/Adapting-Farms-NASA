from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.modules.climate.controller import router as climate_router
from app.modules.parcels.controller import router as parcels_router
from app.modules.rotations.clasificador_cultivo import router as clasificador_router
from app.modules.rotations.clasificador_ingreso import router as ingreso_router
from app.modules.rotations.controller import router as rotations_router

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
app.include_router(clasificador_router)
app.include_router(ingreso_router)
app.include_router(climate_router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}
