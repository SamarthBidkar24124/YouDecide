from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class SongPublic(BaseModel):
  id: str
  name: str
  genre: Optional[str] = None
  uri: Optional[str] = None


class MoodEventPublic(BaseModel):
  id: str
  userId: str
  mood: str
  created_at: datetime
  songs: List[SongPublic] = []


