"""Vercel entrypoint: exposes the FastAPI app that lives in backend/app."""
import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

# Vercel always sits in front of the function and appends the client address to X-Forwarded-For.
os.environ.setdefault("FIELD_SHIFT_TRUST_FORWARDED_FOR", "true")

from app.main import app  # noqa: E402,F401
