from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data/personal_finance.db"
    demo_mode: bool = False
    demo_default_month: str = "2026-06"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
