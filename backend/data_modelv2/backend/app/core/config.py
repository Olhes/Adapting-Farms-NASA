from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="FIELD_SHIFT_", extra="ignore")

    app_name: str = "Field Shift API"
    cors_origins: list[str] = ["*"]


settings = Settings()
