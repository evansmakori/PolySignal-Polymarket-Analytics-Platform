"""Configuration settings for the application."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: Optional[str] = None
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "polymarket"
    DB_SSLMODE: str = "disable"

    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Polymarket API
    GAMMA_BASE: str = "https://gamma-api.polymarket.com"
    CLOB_BASE: str = "https://clob.polymarket.com"
    REQUEST_TIMEOUT: int = 30
    MAX_RETRIES: int = 3
    RETRY_BACKOFF_SEC: int = 2

    # Analytics
    BASE_RATE: float = 0.50
    DEFAULT_DEPTH: int = 10
    DEFAULT_FIDELITY: int = 60
    USE_UTC: bool = True

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    @property
    def database_url(self) -> str:
        """Build database URL from components if DATABASE_URL not set."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        sslmode = self.DB_SSLMODE
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?sslmode={sslmode}"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


# Global settings instance
settings = Settings()
