from datetime import datetime

from pydantic import BaseModel, Field


class DiaryEntryBase(BaseModel):
  content: str = Field(min_length=1)


class DiaryEntryCreate(DiaryEntryBase):
  userId: str


class DiaryEntryUpdate(BaseModel):
  content: str = Field(min_length=1)


class DiaryEntryPublic(DiaryEntryBase):
  id: str
  userId: str
  created_at: datetime
  updated_at: datetime | None = None

  class Config:
    orm_mode = True



