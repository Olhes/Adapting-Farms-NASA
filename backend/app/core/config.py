from pydantic_settings import BaseSettings, SettingsConfigDict

# The frontend is served by this same app (/app/), so browsers call it same-origin and need no CORS at all. These are
# only the local development origins; add others with FIELD_SHIFT_CORS_ORIGINS (comma separated).
DEFAULT_CORS_ORIGINS = "http://localhost:8765,http://127.0.0.1:8765"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="FIELD_SHIFT_", extra="ignore")

    app_name: str = "Field Shift API"
    cors_origins: str = DEFAULT_CORS_ORIGINS
    # Optional: rewrites the rotation explanation in plain Spanish. Set it in backend/.env (never in the repo).
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    # /explain calls a paid external API: at most this many requests per client per minute (429 beyond it).
    explain_rate_limit_per_minute: int = 20
    # Behind a reverse proxy every request comes from the proxy's address. Set this to true ONLY when the app is reachable
    # solely through a proxy that appends the real client address to X-Forwarded-For (otherwise clients could spoof it).
    trust_forwarded_for: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
