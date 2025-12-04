from functools import lru_cache
import os

from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables from a .env file if present
load_dotenv()


class Settings(BaseModel):
  mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
  db_name: str = os.getenv("DB_NAME", "SamarthEDI")
  jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production")
  jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
  access_token_expire_minutes: int = 60 * 24  # 1 day
  groq_api_key: str = os.getenv("GROQ_API_KEY", "")


@lru_cache
def get_settings() -> Settings:
  return Settings()



