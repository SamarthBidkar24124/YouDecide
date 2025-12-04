from datetime import datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from ..db import get_db
from ..models.diary import (
  DiaryEntryCreate,
  DiaryEntryPublic,
  DiaryEntryUpdate,
)

router = APIRouter(prefix="/diary", tags=["diary"])


def _serialize_diary(doc: dict) -> DiaryEntryPublic:
  return DiaryEntryPublic(
    id=str(doc["_id"]),
    userId=doc["userId"],
    content=doc["content"],
    created_at=doc["created_at"],
    updated_at=doc.get("updated_at"),
  )


@router.get("", response_model=List[DiaryEntryPublic])
async def list_entries(
  userId: str = Query(...),
  date: Optional[str] = Query(default=None),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[DiaryEntryPublic]:
  query: dict = {"userId": userId}

  if date:
    try:
      day = datetime.fromisoformat(date)
    except ValueError:
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid date format. Expected YYYY-MM-DD.",
      )
    start = day.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    query["created_at"] = {"$gte": start, "$lt": end}

  cursor = (
    db["diary_entries"]
    .find(query)
    .sort("created_at", -1)
  )
  docs = await cursor.to_list(length=None)
  return [_serialize_diary(doc) for doc in docs]


@router.post("", response_model=DiaryEntryPublic, status_code=status.HTTP_201_CREATED)
async def create_entry(
  payload: DiaryEntryCreate,
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> DiaryEntryPublic:
  now = datetime.utcnow()
  doc = {
    "userId": payload.userId,
    "content": payload.content,
    "created_at": now,
    "updated_at": None,
  }
  result = await db["diary_entries"].insert_one(doc)
  doc["_id"] = result.inserted_id
  return _serialize_diary(doc)


@router.put("/{entry_id}", response_model=DiaryEntryPublic)
async def update_entry(
  entry_id: str,
  payload: DiaryEntryUpdate,
  userId: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> DiaryEntryPublic:
  try:
    oid = ObjectId(entry_id)
  except Exception:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid diary entry id."
    )

  result = await db["diary_entries"].find_one_and_update(
    {"_id": oid, "userId": userId},
    {
      "$set": {
        "content": payload.content,
        "updated_at": datetime.utcnow(),
      }
    },
    return_document=ReturnDocument.AFTER,
  )

  if not result:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Diary entry not found.",
    )

  return _serialize_diary(result)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
  entry_id: str,
  userId: str = Query(...),
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> None:
  try:
    oid = ObjectId(entry_id)
  except Exception:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid diary entry id."
    )

  result = await db["diary_entries"].delete_one({"_id": oid, "userId": userId})
  if result.deleted_count == 0:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Diary entry not found.",
    )

  return None



