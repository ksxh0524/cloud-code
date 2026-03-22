"""Application configuration"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # App
    app_name: str = "Cloud Code"
    debug: bool = False
    
    # Server
    host: str = "0.0.0.0"
    port: int = 18765
    
    # Database
    db_dir: Path = Path.home() / ".cloud-code"
    db_path: Path = db_dir / "data.db"
    
    # CORS
    cors_origins: list[str] = [
        "http://localhost:18766",
        "http://127.0.0.1:18766",
    ]
    
    # CLI
    default_cli_type: str = "claude"
    
    class Config:
        env_file = ".env"


settings = Settings()
