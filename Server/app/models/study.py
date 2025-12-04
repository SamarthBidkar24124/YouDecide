from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class StudySessionCreate(BaseModel):
  userId: str
  start_time: datetime
  duration_minutes: int = Field(ge=1)
  session_date: str  # YYYY-MM-DD in user's local time
  phase_type: Literal["focus", "break"] = "focus"
  completed: bool = True


class StudySessionSummary(BaseModel):
  total_minutes: int
  total_sessions: int
  day_minutes: int | None = None
  day_sessions: int | None = None


class WaterReminderBase(BaseModel):
  reminder_time: datetime
  status: Literal["pending", "done", "skipped"] = "pending"
  day: str  # YYYY-MM-DD


class WaterReminderCreate(BaseModel):
  userId: str
  reminder_time: datetime
  day: str


class WaterReminderUpdate(BaseModel):
  status: Literal["pending", "done", "skipped"]


class WaterReminderPublic(WaterReminderBase):
  id: str
  userId: str


class WaterScheduleCreate(BaseModel):
  userId: str
  day: str  # YYYY-MM-DD in user's local time
  start_hour: int = Field(ge=0, le=23)
  end_hour: int = Field(ge=1, le=24)
  interval_minutes: int = Field(ge=15, le=240)


class StudyTaskBase(BaseModel):
  title: str = Field(min_length=1)
  description: str | None = None
  priority: Literal["low", "medium", "high"] = "medium"
  status: Literal["pending", "in_progress", "done"] = "pending"


class StudyTaskCreate(StudyTaskBase):
  userId: str


class StudyTaskUpdate(BaseModel):
  title: str | None = None
  description: str | None = None
  priority: Literal["low", "medium", "high"] | None = None
  status: Literal["pending", "in_progress", "done"] | None = None


class StudyTaskPublic(StudyTaskBase):
  id: str
  userId: str
  created_at: datetime
  updated_at: datetime | None = None


class StudyStreakPublic(BaseModel):
  userId: str
  current_streak: int
  longest_streak: int
  last_active_date: str | None = None  # YYYY-MM-DD
  active_dates: list[str] = []



