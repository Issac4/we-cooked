from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union

class Settings(BaseSettings):
    # Database
    DB_USER: str = "default_user"
    DB_PASS: str = "default_pass"
    DB_HOST: str = "db"
    DB_NAME: str = "default_name"
    
    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Default Admin (for seeding)
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_EMAIL: str = "admin@example.com"
    DEFAULT_ADMIN_PASSWORD: str = "admin123"


    # Storage
    UPLOAD_DIR: str = "static/uploads"
    ALLOWED_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".webp"}
    MAX_UPLOAD_SIZE_BYTES: int = 5 * 1024 * 1024  # 5MB
    ASSET_CLEANUP_WINDOW_SECONDS: int = 24 * 60 * 60  # Default 24 hours

    # CORS
    ALLOW_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("ALLOW_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
