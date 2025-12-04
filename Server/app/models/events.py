from datetime import datetime

from pydantic import BaseModel, Field


class EventBase(BaseModel):
  title: str = Field(min_length=1)
  start: datetime
  end: datetime
  type: str = "personal"
  notes: str | None = None


class EventCreate(EventBase):
  userId: str


class EventUpdate(BaseModel):
  title: str | None = None
  start: datetime | None = None
  end: datetime | None = None
  type: str | None = None
  notes: str | None = None


class EventPublic(EventBase):
  id: str
  userId: str
  created_at: datetime
  updated_at: datetime | None = None



