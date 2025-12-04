from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..config import get_settings

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
  role: Literal["user", "assistant", "system"]
  content: str


class ChatRequest(BaseModel):
  messages: list[ChatMessage]


class ChatResponse(BaseModel):
  reply: str


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, settings=Depends(get_settings)) -> ChatResponse:
  if not settings.groq_api_key:
    raise HTTPException(
      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
      detail="GROQ_API_KEY is not configured on the server.",
    )

  system_prompt = (
    "You are Wellness Buddy, a friendly study coach and wellness companion for students. "
    "Your job is to: "
    "1) Help with studying: explain concepts in simple words, give examples, help with homework and exams, "
    "and suggest effective study techniques. "
    "2) Support emotional wellness: be kind and encouraging, notice when the student feels stressed or sad, "
    "and gently suggest healthy habits like breaks, breathing, or talking to a trusted adult. "
    "Keep answers concise, positive, and age-appropriate."
  )

  messages = [
    {"role": "system", "content": system_prompt},
    *[{"role": m.role, "content": m.content} for m in request.messages],
  ]

  try:
    async with httpx.AsyncClient(timeout=30.0) as client:
      response = await client.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
          "Authorization": f"Bearer {settings.groq_api_key}",
          "Content-Type": "application/json",
        },
        json={
          "model": "llama-3.1-8b-instant",
          "messages": messages,
        },
      )
  except httpx.RequestError as exc:
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail=f"Error while contacting Groq API: {exc}",
    )

  if response.status_code != 200:
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail=f"Groq API error: {response.text}",
    )

  data = response.json()
  try:
    reply_text = data["choices"][0]["message"]["content"]
  except (KeyError, IndexError, TypeError):
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail="Unexpected response structure from Groq API.",
    )

  return ChatResponse(reply=reply_text)


