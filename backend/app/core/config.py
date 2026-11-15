from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="FIELD_SHIFT_", extra="ignore")

    app_name: str = "Field Shift API"
    cors_origins: list[str] = ["*"]
    # Optional: rewrites the rotation explanation in plain Spanish. Set it in backend/.env (never in the repo).
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"


settings = Settings()
