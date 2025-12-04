from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import (
  APIRouter,
  Depends,
  File,
  Form,
  HTTPException,
  Query,
  UploadFile,
  status,
)
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db import get_db
from ..models.mood import MoodEventPublic, SongPublic
from ..recommender.mood_recommender import recommend_songs_for_mood
from ..services.mood_service import predict_mood_from_image_bytes

router = APIRouter(prefix="/mood", tags=["mood"])


def _serialize_mood_event(doc: dict) -> MoodEventPublic:
  return MoodEventPublic(
    id=str(doc["_id"]),
    userId=doc["userId"],
    mood=doc["mood"],
    created_at=doc["created_at"],
    songs=[
      SongPublic(**song) for song in doc.get("songs", [])
    ],
  )


@router.post(
  "/detect",
  response_model=MoodEventPublic,
  status_code=status.HTTP_201_CREATED,
)
async def detect_mood(
  userId: str = Form(...),
  image: UploadFile = File(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> MoodEventPublic:
  """
  Accept an image from the client, detect the user's mood with the
  CNN model, generate song recommendations, store the event, and
  return the full mood event.
  """
  data = await image.read()
  if not data:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Uploaded image is empty.",
    )

  try:
    mood_label = predict_mood_from_image_bytes(data)
  except Exception as exc:  # pragma: no cover - defensive
    raise HTTPException(
      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
      detail=f"Failed to analyze image: {exc}",
    ) from exc

  songs_models = recommend_songs_for_mood(mood_label)
  songs_payload = [song.model_dump() for song in songs_models]

  now = datetime.utcnow()
  doc = {
    "userId": userId,
    "mood": mood_label,
    "created_at": now,
    "songs": songs_payload,
  }

  result = await db["mood_events"].insert_one(doc)
  doc["_id"] = result.inserted_id

  return _serialize_mood_event(doc)


@router.get(
  "/history",
  response_model=List[MoodEventPublic],
)
async def list_mood_history(
  userId: str = Query(...),
  days: Optional[int] = Query(default=7, ge=1, le=365),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[MoodEventPublic]:
  """
  Return a list of mood events for a user, most recent first.
  Optionally restrict to the last `days` days (default: 7).
  """
  query: dict = {"userId": userId}

  if days is not None:
    cutoff = datetime.utcnow() - timedelta(days=days)
    query["created_at"] = {"$gte": cutoff}

  cursor = db["mood_events"].find(query).sort("created_at", -1)
  docs = await cursor.to_list(length=None)

  return [_serialize_mood_event(doc) for doc in docs]


