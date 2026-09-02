from typing import List, Literal, Optional
from pydantic import ConfigDict, Field, SecretStr
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Настройки приложения из .env."""
    
    # Общие
    APP_NAME: str = "Startup Engine"
    DEBUG: bool = False
    SECRET_KEY: SecretStr = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 дней
    COOKIE_SECURE: bool = True  # dev ставит COOKIE_SECURE=false
    
    # База данных (PostgreSQL)
    DATABASE_URL: str = Field(..., description="postgresql://user:pass@host/db")
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # AI-провайдер
    AI_PROVIDER: Literal["deepseek", "gigachat", "demo"] = "demo"
    
    # DeepSeek (OpenAI-совместимый API)
    DEEPSEEK_API_KEY: Optional[SecretStr] = None
    DEEPSEEK_MODEL: str = "deepseek-chat"
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    
    # GigaChat (Сбер)
    GIGACHAT_API_URL: str = "https://gigachat.devices.sberbank.ru/api/v1"
    GIGACHAT_AUTH_KEY: str = ""
    GIGACHAT_CLIENT_ID: str = ""
    GIGACHAT_SCOPE: str = "GIGACHAT_API_PERS"
    DEMO_MODE: bool = False  # В production всегда False; в .env для dev — DEMO_MODE=true
    DEMO_ACCOUNT_EMAIL: str = "demo@poicho.ru"
    DEMO_ACCOUNT_PASSWORD: Optional[SecretStr] = None  # Override in .env; only used when DEMO_MODE=true
    
    # Email (SMTP) — если SMTP_HOST пуст, отправка отключена (no-op)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "Startup Engine <noreply@poicho.ru>"
    SMTP_USE_TLS: bool = True
    
    model_config = ConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True)

settings = Settings()
