# Configuration: load local settings from environment without embedding secrets.
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    secret_key: str = "change-this-development-key"
    database_url: str = "sqlite:///./gramvision.db"
    upload_dir: str = "./uploads"
    frontend_url: str = "http://localhost:5173"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "GramVision"
    otp_expiry_minutes: int = 5
    otp_resend_cooldown_seconds: int = 60
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

settings = Settings()
