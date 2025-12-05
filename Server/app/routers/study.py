from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from ..db import get_db
from ..models.study import (
  StudySessionCreate,
  StudySessionSummary,
  StudyStreakPublic,
  StudyTaskCreate,
  StudyTaskPublic,
  StudyTaskUpdate,
  WaterReminderCreate,
  WaterReminderPublic,
  WaterReminderUpdate,
  WaterScheduleCreate,
)

router = APIRouter(prefix="/study", tags=["study"])


# Absolute path to the bundled white-noise track at the project root.
# Currently uses the WhatsApp audio file as the default background sound.
WHITE_NOISE_PATH = (
  Path(__file__).resolve().parents[3]
  / "WhatsApp Audio 2025-12-05 at 12.17.07 AM.mpeg"
)


@router.get("/white-noise")
async def get_white_noise() -> FileResponse:
  """
  Stream the default rain white-noise track used by the Study/Pomodoro timer.
  """
  if not WHITE_NOISE_PATH.exists():
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="White noise audio file not found.",
    )

  return FileResponse(
    path=str(WHITE_NOISE_PATH),
    media_type="audio/mpeg",
    filename="WhatsApp Audio 2025-12-05 at 12.17.07 AM.mpeg",
  )


async def _update_streak_for_date(
  db: AsyncIOMotorDatabase, user_id: str, day_str: str
) -> StudyStreakPublic:
  """Increment or create streak data for a given day."""
  streaks = db["study_streaks"]
  existing = await streaks.find_one({"userId": user_id})

  if existing is None:
    doc = {
      "userId": user_id,
      "current_streak": 1,
      "longest_streak": 1,
      "last_active_date": day_str,
      "active_dates": [day_str],
      "updated_at": datetime.utcnow(),
    }
    await streaks.insert_one(doc)
    return StudyStreakPublic(**doc)

  last = existing.get("last_active_date")
  current_streak = int(existing.get("current_streak", 0))
  longest_streak = int(existing.get("longest_streak", 0))

  if last == day_str:
    # Already counted today; just ensure day is recorded in active_dates.
    active_dates = existing.get("active_dates", [])
    if day_str not in active_dates:
      active_dates.append(day_str)
    updated = {
      **existing,
      "active_dates": active_dates,
      "updated_at": datetime.utcnow(),
    }
    await streaks.update_one({"_id": existing["_id"]}, {"$set": updated})
    return StudyStreakPublic(
      userId=updated["userId"],
      current_streak=updated["current_streak"],
      longest_streak=updated["longest_streak"],
      last_active_date=updated["last_active_date"],
      active_dates=updated.get("active_dates", []),
    )

  # Compute difference in days between last and current.
  day = datetime.fromisoformat(day_str).date()
  last_date = (
    datetime.fromisoformat(last).date() if last else None
  )

  if last_date and (day - last_date) == timedelta(days=1):
    current_streak += 1
  else:
    current_streak = 1

  if current_streak > longest_streak:
    longest_streak = current_streak

  active_dates = existing.get("active_dates", [])
  if day_str not in active_dates:
    active_dates.append(day_str)

  update_doc = {
    "current_streak": current_streak,
    "longest_streak": longest_streak,
    "last_active_date": day_str,
    "active_dates": active_dates,
    "updated_at": datetime.utcnow(),
  }

  await streaks.update_one(
    {"_id": existing["_id"]},
    {"$set": update_doc},
  )

  return StudyStreakPublic(
    userId=existing["userId"],
    current_streak=current_streak,
    longest_streak=longest_streak,
    last_active_date=day_str,
    active_dates=active_dates,
  )


@router.post("/sessions", response_model=StudyStreakPublic)
async def create_session(
  payload: StudySessionCreate,
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> StudyStreakPublic:
  doc = {
    "userId": payload.userId,
    "start_time": payload.start_time,
    "duration_minutes": payload.duration_minutes,
    "session_date": payload.session_date,
    "phase_type": payload.phase_type,
    "completed": payload.completed,
    "created_at": datetime.utcnow(),
  }
  await db["study_sessions"].insert_one(doc)

  # Only count completed focus sessions towards streaks.
  if payload.completed and payload.phase_type == "focus":
    return await _update_streak_for_date(db, payload.userId, payload.session_date)

  existing = await db["study_streaks"].find_one({"userId": payload.userId})
  if existing:
    return StudyStreakPublic(
      userId=existing["userId"],
      current_streak=existing.get("current_streak", 0),
      longest_streak=existing.get("longest_streak", 0),
      last_active_date=existing.get("last_active_date"),
      active_dates=existing.get("active_dates", []),
    )

  # No streak yet.
  return StudyStreakPublic(
    userId=payload.userId,
    current_streak=0,
    longest_streak=0,
    last_active_date=None,
    active_dates=[],
  )


@router.get("/sessions/summary", response_model=StudySessionSummary)
async def sessions_summary(
  userId: str = Query(...),
  day: Optional[str] = Query(default=None),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> StudySessionSummary:
  query_all = {"userId": userId, "completed": True, "phase_type": "focus"}
  cursor_all = db["study_sessions"].find(query_all)
  docs_all = await cursor_all.to_list(length=None)

  total_minutes = sum(int(doc.get("duration_minutes", 0)) for doc in docs_all)
  total_sessions = len(docs_all)

  day_minutes = None
  day_sessions = None

  if day:
    docs_day = [doc for doc in docs_all if doc.get("session_date") == day]
    day_minutes = sum(int(doc.get("duration_minutes", 0)) for doc in docs_day)
    day_sessions = len(docs_day)

  return StudySessionSummary(
    total_minutes=total_minutes,
    total_sessions=total_sessions,
    day_minutes=day_minutes,
    day_sessions=day_sessions,
  )


@router.get("/water", response_model=List[WaterReminderPublic])
async def list_water_reminders(
  userId: str = Query(...),
  day: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[WaterReminderPublic]:
  cursor = (
    db["water_events"]
    .find({"userId": userId, "day": day})
    .sort("reminder_time", 1)
  )
  docs = await cursor.to_list(length=None)
  return [
    WaterReminderPublic(
      id=str(doc["_id"]),
      userId=doc["userId"],
      reminder_time=doc["reminder_time"],
      status=doc["status"],
      day=doc["day"],
    )
    for doc in docs
  ]


@router.post("/water/bulk", response_model=List[WaterReminderPublic])
async def create_water_schedule(
  payload: WaterScheduleCreate,
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[WaterReminderPublic]:
  # If schedule for the day already exists, just return it.
  existing = await db["water_events"].find_one(
    {"userId": payload.userId, "day": payload.day}
  )
  if existing:
    return await list_water_reminders(
      userId=payload.userId, day=payload.day, db=db
    )

  try:
    day_date = datetime.fromisoformat(payload.day).date()
  except ValueError:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Invalid day format. Expected YYYY-MM-DD.",
    )

  reminders: list[dict] = []
  start_minutes = payload.start_hour * 60
  end_minutes = payload.end_hour * 60

  current = start_minutes
  while current < end_minutes:
    hours, minutes = divmod(current, 60)
    reminder_dt = datetime(
      day_date.year,
      day_date.month,
      day_date.day,
      hours,
      minutes,
    )
    reminders.append(
      {
        "userId": payload.userId,
        "reminder_time": reminder_dt,
        "status": "pending",
        "day": payload.day,
        "created_at": datetime.utcnow(),
      }
    )
    current += payload.interval_minutes

  if not reminders:
    return []

  result = await db["water_events"].insert_many(reminders)
  inserted_ids = result.inserted_ids

  docs = [
    {
      **reminders[i],
      "_id": inserted_ids[i],
    }
    for i in range(len(inserted_ids))
  ]

  docs.sort(key=lambda d: d["reminder_time"])

  return [
    WaterReminderPublic(
      id=str(doc["_id"]),
      userId=doc["userId"],
      reminder_time=doc["reminder_time"],
      status=doc["status"],
      day=doc["day"],
    )
    for doc in docs
  ]


@router.put("/water/{reminder_id}", response_model=WaterReminderPublic)
async def update_water_status(
  reminder_id: str,
  payload: WaterReminderUpdate,
  userId: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> WaterReminderPublic:
  try:
    oid = ObjectId(reminder_id)
  except Exception:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reminder id."
    )

  result = await db["water_events"].find_one_and_update(
    {"_id": oid, "userId": userId},
    {"$set": {"status": payload.status}},
    return_document=ReturnDocument.AFTER,
  )
  if not result:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Water reminder not found.",
    )

  return WaterReminderPublic(
    id=str(result["_id"]),
    userId=result["userId"],
    reminder_time=result["reminder_time"],
    status=result["status"],
    day=result["day"],
  )


@router.get("/tasks", response_model=List[StudyTaskPublic])
async def list_tasks(
  userId: str = Query(...),
  status_filter: Optional[str] = Query(default=None, alias="status"),
  priority_filter: Optional[str] = Query(default=None, alias="priority"),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[StudyTaskPublic]:
  query: dict = {"userId": userId}
  if status_filter:
    query["status"] = status_filter
  if priority_filter:
    query["priority"] = priority_filter

  cursor = (
    db["study_tasks"]
    .find(query)
    .sort(
      [
        ("priority", -1),
        ("created_at", -1),
      ]
    )
  )
  docs = await cursor.to_list(length=None)
  return [
    StudyTaskPublic(
      id=str(doc["_id"]),
      userId=doc["userId"],
      title=doc["title"],
      description=doc.get("description"),
      priority=doc.get("priority", "medium"),
      status=doc.get("status", "pending"),
      created_at=doc["created_at"],
      updated_at=doc.get("updated_at"),
    )
    for doc in docs
  ]


@router.post("/tasks", response_model=StudyTaskPublic, status_code=status.HTTP_201_CREATED)
async def create_task(
  payload: StudyTaskCreate,
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> StudyTaskPublic:
  now = datetime.utcnow()
  doc = {
    "userId": payload.userId,
    "title": payload.title,
    "description": payload.description,
    "priority": payload.priority,
    "status": payload.status,
    "created_at": now,
    "updated_at": None,
  }
  result = await db["study_tasks"].insert_one(doc)
  doc["_id"] = result.inserted_id
  return StudyTaskPublic(
    id=str(doc["_id"]),
    userId=doc["userId"],
    title=doc["title"],
    description=doc.get("description"),
    priority=doc.get("priority", "medium"),
    status=doc.get("status", "pending"),
    created_at=doc["created_at"],
    updated_at=doc.get("updated_at"),
  )


@router.put("/tasks/{task_id}", response_model=StudyTaskPublic)
async def update_task(
  task_id: str,
  payload: StudyTaskUpdate,
  userId: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> StudyTaskPublic:
  try:
    oid = ObjectId(task_id)
  except Exception:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid task id."
    )

  update_fields: dict = {k: v for k, v in payload.dict().items() if v is not None}
  if not update_fields:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="No fields to update.",
    )

  update_fields["updated_at"] = datetime.utcnow()

  # Need to know if status changed to done to update streaks.
  existing = await db["study_tasks"].find_one({"_id": oid, "userId": userId})
  if not existing:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Task not found.",
    )

  result = await db["study_tasks"].find_one_and_update(
    {"_id": oid, "userId": userId},
    {"$set": update_fields},
    return_document=ReturnDocument.AFTER,
  )
  if not result:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Task not found.",
    )

  # If task moved to done, update streaks for today.
  new_status = update_fields.get("status")
  if new_status == "done":
    today_str = datetime.utcnow().date().isoformat()
    await _update_streak_for_date(db, userId, today_str)

  return StudyTaskPublic(
    id=str(result["_id"]),
    userId=result["userId"],
    title=result["title"],
    description=result.get("description"),
    priority=result.get("priority", "medium"),
    status=result.get("status", "pending"),
    created_at=result["created_at"],
    updated_at=result.get("updated_at"),
  )


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
  task_id: str,
  userId: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> None:
  try:
    oid = ObjectId(task_id)
  except Exception:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid task id."
    )

  result = await db["study_tasks"].delete_one({"_id": oid, "userId": userId})
  if result.deleted_count == 0:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Task not found.",
    )

  return None


@router.get("/streak", response_model=StudyStreakPublic)
async def get_streak(
  userId: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> StudyStreakPublic:
  existing = await db["study_streaks"].find_one({"userId": userId})
  if not existing:
    return StudyStreakPublic(
      userId=userId,
      current_streak=0,
      longest_streak=0,
      last_active_date=None,
      active_dates=[],
    )

  return StudyStreakPublic(
    userId=existing["userId"],
    current_streak=existing.get("current_streak", 0),
    longest_streak=existing.get("longest_streak", 0),
    last_active_date=existing.get("last_active_date"),
    active_dates=existing.get("active_dates", []),
  )



