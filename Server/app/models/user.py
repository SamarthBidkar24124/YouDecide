from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
  email: EmailStr


class UserCreate(UserBase):
  password: str = Field(min_length=6)


class UserLogin(UserBase):
  password: str


class UserPublic(UserBase):
  id: str

  class Config:
    orm_mode = True
