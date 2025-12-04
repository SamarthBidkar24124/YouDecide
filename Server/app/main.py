from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth, chat, diary, events, mood, study

app = FastAPI(title="Wellness Buddy API")

origins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(diary.router)
app.include_router(study.router)
app.include_router(events.router)
app.include_router(mood.router)


@app.get("/health")
async def health_check() -> dict[str, str]:
  return {"status": "ok"}


