from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from ..db import get_db
from ..models.events import EventCreate, EventPublic, EventUpdate

router = APIRouter(prefix="/events", tags=["events"])


def _serialize_event(doc: dict) -> EventPublic:
  return EventPublic(
    id=str(doc["_id"]),
    userId=doc["userId"],
    title=doc["title"],
    start=doc["start"],
    end=doc["end"],
    type=doc.get("type", "personal"),
    notes=doc.get("notes"),
    created_at=doc["created_at"],
    updated_at=doc.get("updated_at"),
  )


@router.get("", response_model=List[EventPublic])
async def list_events(
  userId: str = Query(...),
  time_from: Optional[datetime] = Query(default=None, alias="from"),
  time_to: Optional[datetime] = Query(default=None, alias="to"),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[EventPublic]:
  query: dict = {"userId": userId}
  if time_from and time_to:
    query["start"] = {"$gte": time_from, "$lt": time_to}

  cursor = db["events"].find(query).sort("start", 1)
  docs = await cursor.to_list(length=None)
  return [_serialize_event(doc) for doc in docs]


@router.post("", response_model=EventPublic, status_code=status.HTTP_201_CREATED)
async def create_event(
  payload: EventCreate,
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> EventPublic:
  now = datetime.utcnow()
  doc = {
    "userId": payload.userId,
    "title": payload.title,
    "start": payload.start,
    "end": payload.end,
    "type": payload.type,
    "notes": payload.notes,
    "created_at": now,
    "updated_at": None,
  }
  result = await db["events"].insert_one(doc)
  doc["_id"] = result.inserted_id
  return _serialize_event(doc)


@router.put("/{event_id}", response_model=EventPublic)
async def update_event(
  event_id: str,
  payload: EventUpdate,
  userId: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> EventPublic:
  try:
    oid = ObjectId(event_id)
  except Exception:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Invalid event id.",
    )

  update_fields: dict = {k: v for k, v in payload.dict().items() if v is not None}
  if not update_fields:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="No fields to update.",
    )
  update_fields["updated_at"] = datetime.utcnow()

  result = await db["events"].find_one_and_update(
    {"_id": oid, "userId": userId},
    {"$set": update_fields},
    return_document=ReturnDocument.AFTER,
  )
  if not result:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Event not found.",
    )

  return _serialize_event(result)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
  event_id: str,
  userId: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> None:
  try:
    oid = ObjectId(event_id)
  except Exception:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Invalid event id.",
    )

  result = await db["events"].delete_one({"_id": oid, "userId": userId})
  if result.deleted_count == 0:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Event not found.",
    )

  return None



