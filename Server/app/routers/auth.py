from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext

from ..config import get_settings
from ..db import get_db
from ..models.user import UserCreate, UserLogin, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
  return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
  return pwd_context.verify(plain_password, hashed_password)


@router.post("/register", response_model=UserPublic)
async def register_user(
  payload: UserCreate,
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> UserPublic:
  existing = await db["Buddy"].find_one({"email": payload.email})
  if existing:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Email already registered",
    )

  hashed_password = get_password_hash(payload.password)

  doc = {
    "email": payload.email,
    "hashed_password": hashed_password,
    "created_at": datetime.utcnow(),
  }
  result = await db["Buddy"].insert_one(doc)

  user = UserPublic(id=str(result.inserted_id), email=payload.email)
  return user


@router.post("/login", response_model=UserPublic)
async def login_user(
  payload: UserLogin,
  db: AsyncIOMotorDatabase = Depends(get_db),
) -> UserPublic:
  user_doc = await db["Buddy"].find_one({"email": payload.email})
  if not user_doc:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Incorrect email or password",
    )

  if not verify_password(payload.password, user_doc["hashed_password"]):
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Incorrect email or password",
    )

  return UserPublic(id=str(user_doc["_id"]), email=user_doc["email"])


@router.post("/logout")
async def logout() -> dict[str, str]:
  # No server-side session to clear; client will drop its local auth state.
  return {"message": "Logged out"}