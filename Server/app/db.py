from typing import AsyncGenerator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

settings = get_settings()

client = AsyncIOMotorClient(settings.mongodb_uri)
database = client[settings.db_name]


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
  yield database


