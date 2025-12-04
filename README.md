## Wellness Buddy – Emotion‑Aware Study & Wellness Companion

Wellness Buddy is a full‑stack application that helps students track their mood, plan study sessions, keep a diary, stay hydrated, and chat with an AI wellness coach.  
It combines:

- **Client (`Client/`)**: React + TypeScript + Tailwind CSS single‑page app.
- **API Server (`Server/`)**: FastAPI + MongoDB backend with REST endpoints.
- **ML Assets (`Mood-Based-Song-Recommender-main/`)**:  
  Pre‑trained CNN for **face‑based emotion detection** and a **mood‑aware song recommender**.

This README documents the **overall architecture, data flow, and all key features** across the codebase.

---

## High‑Level Architecture

- **React app ↔ FastAPI backend**
  - The frontend talks to the backend via REST using the helper in `Client/src/lib/api.ts`.
  - Base URL is configured by `VITE_API_BASE_URL` (defaults to `http://127.0.0.1:8000`).
- **FastAPI ↔ MongoDB**
  - Backend uses `motor` (async MongoDB driver) in `Server/app/db.py`.
  - Collections store users, mood events, diary entries, study data, events, and water reminders.
- **FastAPI ↔ ML assets**
  - `Server/app/services/mood_service.py` loads a CNN model from `Mood-Based-Song-Recommender-main/.../Model/model_weights_training_optimal.h5` and runs **emotion detection** on camera snapshots.
  - `Server/app/recommender/mood_recommender.py` loads `genres.csv` from `Mood-Based-Song-Recommender-main/.../Data/genres.csv` and recommends songs for a given mood.
- **FastAPI ↔ Groq API**
  - `Server/app/routers/chat.py` proxies chat requests to the Groq Llama‑3.1 API when `GROQ_API_KEY` is configured.

---

## Backend (`Server/`) – FastAPI + MongoDB + ML

### Tech Stack

- **Framework**: FastAPI
- **Database**: MongoDB via `motor.motor_asyncio.AsyncIOMotorClient`
- **Models/validation**: Pydantic
- **Auth security**: `passlib` (bcrypt hashing)
- **ML / CV**:
  - `tensorflow.keras` – CNN architecture & weights loader
  - `opencv-python` (`cv2`) – image decoding & face detection
  - `numpy` – tensor manipulation
- **Recommender**: `pandas` + CSV dataset
- **HTTP client for chat**: `httpx`

### Configuration & Environment

Defined in `Server/app/config.py`:

- **`MONGODB_URI`** – connection string (default `mongodb://localhost:27017`)
- **`DB_NAME`** – database name (default `SamarthEDI`)
- **`JWT_SECRET` / `JWT_ALGORITHM`** – currently unused for token issuance but reserved for future JWT support.
- **`ACCESS_TOKEN_EXPIRE_MINUTES`** – reserved for future token expiry handling.
- **`GROQ_API_KEY`** – required for the `/chat` endpoint.

`Server/app/db.py`:

- Creates a global `AsyncIOMotorClient` and exposes `database = client[settings.db_name]`.
- Dependency `get_db()` yields the `AsyncIOMotorDatabase` instance to each route.

### Application Entry Point

`Server/app/main.py`:

- Instantiates `FastAPI(title="Wellness Buddy API")`.
- Registers CORS for:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- Includes routers:
  - `auth`, `chat`, `diary`, `study`, `events`, `mood`
- Health check:
  - **`GET /health`** → `{ "status": "ok" }`

### Data Models (Pydantic)

Key models live in `Server/app/models` and describe API payloads and responses:

- **`user.py`**
  - `UserCreate { email, password(min 6) }`
  - `UserLogin { email, password }`
  - `UserPublic { id, email }`

- **`mood.py`**
  - `SongPublic { id, name, genre?, uri? }`
  - `MoodEventPublic { id, userId, mood, created_at, songs: SongPublic[] }`

- **`diary.py`**
  - `DiaryEntryCreate { userId, content }`
  - `DiaryEntryUpdate { content }`
  - `DiaryEntryPublic { id, userId, content, created_at, updated_at? }`

- **`study.py`**
  - `StudySessionCreate { userId, start_time, duration_minutes, session_date (YYYY‑MM‑DD), phase_type, completed }`
  - `StudySessionSummary { total_minutes, total_sessions, day_minutes?, day_sessions? }`
  - `WaterReminderCreate/Update/Public`
  - `WaterScheduleCreate { userId, day, start_hour, end_hour, interval_minutes }`
  - `StudyTaskCreate/Update/Public`
  - `StudyStreakPublic { userId, current_streak, longest_streak, last_active_date?, active_dates[] }`

- **`events.py`**
  - `EventCreate/Update/Public` – calendar events (title, start, end, type, notes, timestamps).

### MongoDB Collections (Conceptual)

While schema is implicit (MongoDB is schemaless), code clearly uses these collections:

- **`Buddy`** – users `{ email, hashed_password, created_at }`.
- **`mood_events`** – detected mood events with attached songs.
- **`diary_entries`** – per‑user diary text with timestamps.
- **`study_sessions`** – per‑session records for streaks and stats.
- **`study_streaks`** – one document per user: current streak, longest streak, active dates.
- **`study_tasks`** – user to‑dos with priority and status.
- **`water_events`** – generated hydration reminders for a given day.
- **`events`** – personal/calendar events for diary planning.

---

## Backend API – Endpoints by Router

### Auth – `Server/app/routers/auth.py`

**Base path**: `/auth`  
**Note**: Authentication is **email + password with bcrypt hashing**, but **no JWT is issued** yet; the frontend stores the returned `UserPublic` locally and treats that as “logged in”.

- **`POST /auth/register`**
  - Body: `UserCreate { email, password }`
  - Logic:
    - Fails if a document with same email exists in `Buddy`.
    - Hashes password with bcrypt and stores `{ email, hashed_password, created_at }`.
  - Returns: `UserPublic { id, email }`.

- **`POST /auth/login`**
  - Body: `UserLogin { email, password }`
  - Logic:
    - Looks up `Buddy` by email.
    - Verifies password using bcrypt.
  - Returns: `UserPublic { id, email }` or `401` on failure.

- **`POST /auth/logout`**
  - Stateless on the server – just returns `{ "message": "Logged out" }`.  
    Frontend clears local storage.

### Mood – Camera & Song Recommender – `Server/app/routers/mood.py`

**Base path**: `/mood`

- **`POST /mood/detect`**
  - Multipart form:
    - `userId` – string
    - `image` – uploaded image (captured by webcam on the client)
  - Flow:
    - Reads image bytes and forwards them to `predict_mood_from_image_bytes` in `mood_service.py`.
    - Maps CNN prediction to one of: **Angry, Sad, Happy, Calm**.
    - Calls `recommend_songs_for_mood(mood_label)` to get a list of `Song` models.
    - Stores the document in `mood_events`.
  - Response: `MoodEventPublic { id, userId, mood, created_at, songs: SongPublic[] }`.

- **`GET /mood/history?userId=...&days=7`**
  - Query:
    - `userId` – required
    - `days` – optional (1–365, default 7)
  - Returns a list of mood events for that user, most recent first.

### Diary – `Server/app/routers/diary.py`

**Base path**: `/diary`

- **`GET /diary?userId=...&date=YYYY-MM-DD?`**
  - Lists diary entries for user; optional `date` narrows to that day.

- **`POST /diary`**
  - Body: `DiaryEntryCreate { userId, content }`
  - Creates a new diary entry with timestamps.

- **`PUT /diary/{entry_id}?userId=...`**
  - Body: `DiaryEntryUpdate { content }`
  - Updates content and `updated_at`. Validates `entry_id` as `ObjectId` and ownership.

- **`DELETE /diary/{entry_id}?userId=...`**
  - Deletes the diary entry for that user.

### Study – Timer, Streaks, Tasks, Water – `Server/app/routers/study.py`

**Base path**: `/study`

Key helper:

- `_update_streak_for_date(db, user_id, day_str)`  
  Maintains `study_streaks` documents:
  - Increments `current_streak` if the given day is consecutive to the last active day.
  - Updates `longest_streak` and `active_dates`.

Endpoints:

- **`POST /study/sessions`**
  - Body: `StudySessionCreate`
  - Writes a session to `study_sessions`.
  - If `phase_type == "focus"` and `completed`, updates the streak for that date and returns `StudyStreakPublic`.

- **`GET /study/sessions/summary?userId=...&day=YYYY-MM-DD?`**
  - Returns aggregate statistics:
    - Total minutes & sessions across all focus sessions.
    - Optional per‑day minutes/sessions.

- **`GET /study/water?userId=...&day=YYYY-MM-DD`**
  - Lists water reminders from `water_events` for a specific day, sorted by time.

- **`POST /study/water/bulk`**
  - Body: `WaterScheduleCreate { userId, day, start_hour, end_hour, interval_minutes }`
  - If schedule exists, returns existing reminders.
  - Otherwise:
    - Generates a series of reminders across the day at the given interval.
    - Inserts into `water_events` and returns all of them.

- **`PUT /study/water/{reminder_id}?userId=...`**
  - Body: `WaterReminderUpdate { status: "pending" | "done" | "skipped" }`
  - Updates a single water reminder’s status.

- **`GET /study/tasks?userId=...&status=...&priority=...`**
  - Returns filtered study tasks for the user, sorted by priority and creation time.

- **`POST /study/tasks`**
  - Body: `StudyTaskCreate`
  - Creates a new task in `study_tasks`.

- **`PUT /study/tasks/{task_id}?userId=...`**
  - Body: `StudyTaskUpdate` (partial update)
  - Updates fields and, if status becomes `"done"`, also updates streaks for today.

- **`DELETE /study/tasks/{task_id}?userId=...`**
  - Deletes a task for the user.

- **`GET /study/streak?userId=...`**
  - Returns `StudyStreakPublic` with current and longest streak plus active dates.

### Events – Calendar – `Server/app/routers/events.py`

**Base path**: `/events`

- **`GET /events?userId=...&from=...&to=...`**
  - Lists events for a user.
  - Optional `from` / `to` filter by the start timestamp range.

- **`POST /events`**
  - Body: `EventCreate { userId, title, start, end, type, notes? }`
  - Creates a calendar event.

- **`PUT /events/{event_id}?userId=...`**
  - Body: `EventUpdate` (partial)
  - Updates event fields, sets `updated_at`.

- **`DELETE /events/{event_id}?userId=...`**
  - Deletes a user’s event by id.

### Chat – AI Wellness Buddy – `Server/app/routers/chat.py`

**Base path**: `/chat`

- **`POST /chat`**
  - Body:
    - `{ messages: { role: "user" | "assistant" | "system", content: string }[] }`
  - Server:
    - Prepends a rich **system prompt** describing the Wellness Buddy persona.
    - Sends request to Groq’s OpenAI‑compatible chat completions API with model `llama-3.1-8b-instant`.
  - Response:
    - `{ reply: string }`

Requires `GROQ_API_KEY` in environment; otherwise returns a `500` with a helpful message.

---

## ML Emotion Detection & Song Recommender

### Emotion Detection – `Server/app/services/mood_service.py`

- Resolves **project root** (the `EDI@` directory) and computes:
  - `MODEL_DIR = <root>/Mood-Based-Song-Recommender-main/Mood-Based-Song-Recommender-main/Model`
  - `WEIGHTS_PATH = MODEL_DIR / "model_weights_training_optimal.h5"`
- Builds a CNN with:
  - Multiple `Conv2D` + `MaxPooling2D` layers
  - Dense layer of 1024 units + dropout
  - Final softmax with 4 outputs.
- Lazily loads weights on first call (`_get_model()`).
- `predict_mood_from_image_bytes(image_bytes: bytes) -> str`:
  - Decodes JPEG/PNG bytes to an OpenCV image.
  - Converts to grayscale and runs a Haar cascade face detector.
  - If a face is found, crops; otherwise, falls back to a center crop.
  - Resizes to 48×48, runs the CNN, and maps the argmax to:
    - `0 → Angry`, `1 → Sad`, `2 → Happy`, `3 → Calm`.

If weights file is missing, it raises a clear `FileNotFoundError` with an instruction on where to place them.

### Song Recommender – `Server/app/recommender/mood_recommender.py`

- Resolves `DATA_PATH` to:
  - `<root>/Mood-Based-Song-Recommender-main/Mood-Based-Song-Recommender-main/Data/genres.csv`
- Loads the CSV into `_df` at import time; if missing, raises a clear `FileNotFoundError`.
- `recommend_songs_for_mood(mood: str, limit: int = 10) -> List[Song]`:
  - Filters `_df` based on:
    - **happy** → high `valence`
    - **sad** → low `valence`
    - **calm** → high `acousticness` and low `energy`
    - **angry** → high `energy`
    - unknown → no filter
  - Randomly samples up to `limit` tracks.
  - Normalizes track name, id, optional genre.
  - Converts `spotify:track:*` URIs to web URLs, otherwise creates a **YouTube search URL** from song + artist.

Returned `Song` models are then exposed to the frontend as `SongPublic` inside `MoodEventPublic`.

---

## Frontend (`Client/`) – React + TypeScript + Tailwind

### Tech Stack

- **React 18 + TypeScript** (`src/App.tsx`, `src/main.tsx`)
- **Styling**: Tailwind CSS (`src/index.css`, `tailwind.config.js`)
- **Charts**: `recharts`
- **Calendar**: `react-calendar`
- **Icons**: `lucide-react`
- **State / Context**: Custom `AuthContext` and `ThemeContext`

### Application Shell – `src/App.tsx`

- Wraps the app in:
  - `ThemeProvider` (`ThemeContext`) – manages aesthetic themes.
  - `AuthProvider` (`AuthContext`) – manages logged‑in user.
- `AppContent` logic:
  - Reads `{ user, loading }` from `useAuth()`.
  - When `user` is `null` → shows `<Login />`.
  - After login:
    - Checks `localStorage` for `profile_${user.id}`.
    - If missing → shows `<ProfileSetup />`.
    - If present → uses stored `gender` (`male`/`female`/`other`) to set theme to `boy`, `girl`, or time‑of‑day.
  - Displays `<Dashboard />` when both auth and profile are set.

### Auth & API Layer

- **`src/contexts/AuthContext.tsx`**
  - Persists `AuthUser { id, email }` in `localStorage` under `auth_user`.
  - Methods:
    - `login(email, password)` → `POST /auth/login`
    - `register(email, password)` → `POST /auth/register`
    - `logout()` → `POST /auth/logout` then clear state.

- **`src/lib/api.ts`**
  - `API_BASE_URL` from `VITE_API_BASE_URL` (fallback `http://127.0.0.1:8000`).
  - `request<T>(path, options)`:
    - Always sends `Content-Type: application/json`.
    - Parses JSON or throws an `ApiError` with `status` and server `detail/message`.
  - Helper methods: `api.get`, `api.post`, `api.put`, `api.delete`.

### Theming – `src/contexts/ThemeContext.tsx`

- `ThemeName`: `"morning" | "day | "evening" | "boy" | "girl"`.
- `getInitialTheme()`:
  - Morning: 05:00–11:00
  - Day: 11:00–18:00
  - Evening: otherwise.
- `getThemeClasses(theme)` returns tailwind class sets for:
  - Background gradient, card gradient, soft accent.
- `ThemeProvider` stores theme in React state and exposes `classes` for use across UI.

### Main Screens / Components

#### Dashboard – `src/components/Dashboard.tsx`

- Bottom tab navigation with four tabs:
  - **Mood** → `<MoodTrack />`
  - **Study** → `<StudyMode />`
  - **Diary** → `<Diary />`
  - **Chat** → `<Chatbot />`
- Shows header with “Wellness Buddy” branding and logout button.

#### Login – `src/components/Login.tsx`

- Handles both **Login** and **Sign Up** modes (toggle).
- Uses `useAuth()` to call `login`/`register`.
- On success, calls `onSuccess()` which triggers profile check.
- Animated, kid‑friendly UI using Tailwind and inline keyframe CSS.

#### Profile Setup – `src/components/ProfileSetup.tsx`

- Collects:
  - `nickname`
  - `gender` ("male", "female", "other")
- Persists profile locally:
  - `localStorage.setItem("profile_<user.id>", JSON.stringify(profile))`
- Updates background gradient live based on selected gender.
- On success, calls `onComplete()` which leads to `Dashboard`.

#### Mood Track – `src/components/MoodTrack.tsx`

- Two forms of mood tracking:
  1. **Manual mood selection**
     - User taps mood cards such as `happy`, `sad`, `calm`, `excited`, `loved`, `neutral`.
     - Saves last 7 mood entries per user in `localStorage` (`moods_<user.id>`).
     - Renders simple bar‑style progress bars per mood.
  2. **Camera mood tracking + history**
     - Uses `<MoodCamera onNewMood={...} />`.
     - Also fetches server history:
       - `GET /mood/history?userId=<id>&days=7`.
       - Aggregates counts by mood and displays them using `recharts` as a bar chart.

#### Mood Camera – `src/components/MoodCamera.tsx`

- Controls webcam:
  - `Start Camera` → `navigator.mediaDevices.getUserMedia`.
  - `Stop Camera` → stops tracks & clears video.
- On **Capture & Detect**:
  - Draws current video frame to a hidden `<canvas>`.
  - Encodes as JPEG, sends as `FormData` to `POST /mood/detect`:
    - `image`: captured jpg
    - `userId`: logged‑in user id
  - Parses `MoodEvent` response:
    - Displays detected `mood` and timestamp.
    - Lists recommended `songs` with a “Play” link (to Spotify or YouTube).
    - Calls `onNewMood` callback so `MoodTrack` can update the global chart.

#### Diary – `src/components/Diary.tsx`

- Combines:
  - **Diary writing**
    - Text area for current entry.
    - `Save Entry` → `POST /diary { userId, content }`
    - `Update Entry` → `PUT /diary/{id}?userId=...`
    - `Delete` → `DELETE /diary/{id}?userId=...`
    - Lists “Previous Entries” with created date, Edit, and Delete actions.
  - **Calendar + event planning**
    - Uses `react-calendar` to show days.
    - For selected date:
      - Loads events via:
        - `GET /events?userId=...&from=<startOfDay>&to=<endOfDay>`
      - Allows creating events via:
        - `POST /events { userId, title, start, end, type, notes? }`
      - Allows deletion via:
        - `DELETE /events/{id}?userId=...`
    - Marks calendar days that have diary entries.

#### Study Mode – `src/components/StudyMode.tsx`

Provides a rich **Pomodoro‑style study hub**:

- **Timer**
  - Alternates between:
    - Focus: 25 minutes
    - Break: 5 minutes
  - Visual circular progress indicator.
  - On completion of a focus session:
    - Plays an inline‑encoded bell sound.
    - Sends `POST /study/sessions` to record session and update streak.
  - Optional white‑noise audio playback, toggled with a button.

- **Progress & Streaks**
  - Uses:
    - `GET /study/sessions/summary?userId=...&day=...`
    - `GET /study/streak?userId=...`
  - Displays:
    - Total minutes studied.
    - Total sessions.
    - Today’s sessions.
    - Current and longest streak.
    - 4‑week grid of active days.

- **Hydration timeline**
  - On load:
    - Fetches `GET /study/water?userId=...&day=...`.
    - If none exist, calls `POST /study/water/bulk` to generate schedule (09:00–21:00 every 90 minutes).
  - Shows each reminder as a “drop” with time and status.
  - Buttons for:
    - Mark done → `PUT /study/water/{id}?userId=...` with `status: "done"`.
    - Skip → same endpoint with `status: "skipped"`.

- **Study to‑dos**
  - CRUD on `study_tasks` collection via `/study/tasks` endpoints.
  - Add task with title, optional description, and priority (high/medium/low).
  - Filter by status and priority.
  - Changing a task to `"done"` also triggers streak refresh via `/study/streak`.

#### Chatbot – `src/components/Chatbot.tsx`

- Chat UI with:
  - Scrollable message history.
  - Bubbles styled differently for user and bot.
  - Basic typing indicator when waiting for a response.
- On send:
  - Takes full local message history, maps to `{ role, content }[]`.
  - Calls `POST /chat`.
  - Appends bot reply to the message list.

---

## Supabase Schema (`Client/supabase/migrations/...`)

The migration describes a **Postgres/Supabase** schema with:

- `profiles { id, nickname, gender, created_at }`
- `mood_entries { id, user_id, mood, music_recommendation, created_at }`
- `diary_entries { id, user_id, content, created_at, updated_at }`
- `study_sessions { id, user_id, duration, completed, created_at }`

All tables:

- Have **Row Level Security enabled**.
- Include policies so authenticated users can manage **only their own rows**.

**Important**: The current React app primarily uses the **FastAPI + MongoDB** backend directly; the Supabase schema is a parallel/alternative persistence layer and is not wired into the app at this time.

---

## Running the Project Locally

### Prerequisites

- **Node.js** (v18+ recommended)
- **Python 3.10+**
- **MongoDB** running locally or accessible via `MONGODB_URI`
- **Python ML dependencies** (installed via `Server/requirements.txt`)
- **ML assets present** under `Mood-Based-Song-Recommender-main/Mood-Based-Song-Recommender-main`:
  - `Model/model_weights_training_optimal.h5`
  - `Data/genres.csv`

### 1. Backend – FastAPI Server

From the `Server` directory:

```bash
cd Server
python -m venv .venv
.\.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

Create `Server/.env` (or set environment variables in your shell):

```bash
MONGODB_URI=mongodb://localhost:27017
DB_NAME=SamarthEDI
JWT_SECRET=change-this-secret
JWT_ALGORITHM=HS256
GROQ_API_KEY=your_groq_api_key_here  # optional, required only for /chat
```

Run the server:

```bash
uvicorn app.main:app --reload
```

By default the API will listen on `http://127.0.0.1:8000`.

### 2. Frontend – React SPA

From the `Client` directory:

```bash
cd Client
npm install
```

Create `Client/.env` (or `.env.local`) with at least:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000

# Optional, if you decide to use Supabase elsewhere
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the dev server:

```bash
npm run dev
```

Open the app at `http://127.0.0.1:5173` (or the URL Vite prints).

---

## Repository Structure (High Level)

- **`Client/`** – React + TypeScript frontend
  - `src/App.tsx` – app shell and routing between login/profile/dashboard
  - `src/components/` – UI components for mood, study, diary, chatbot, etc.
  - `src/contexts/` – `AuthContext`, `ThemeContext`
  - `src/lib/api.ts` – API helper
  - `src/lib/supabase.ts` – Supabase client (currently not wired into main flows)
  - `supabase/migrations/...` – Postgres/Supabase schema definition
- **`Server/`** – FastAPI backend
  - `app/main.py` – FastAPI app, router registration, CORS
  - `app/config.py` – settings & environment variables
  - `app/db.py` – MongoDB client and dependency
  - `app/models/` – Pydantic models for all resources
  - `app/routers/` – REST endpoints for auth, mood, diary, study, events, chat
  - `app/services/mood_service.py` – CNN‑based emotion detection
  - `app/recommender/mood_recommender.py` – mood‑aware song recommender
- **`Mood-Based-Song-Recommender-main/`**
  - Original ML project with notebooks, models, and datasets used by the backend.

---

## Notes & Possible Extensions

- **Auth tokens**: Backend currently returns only user info; JWT issuance could be added using the existing config fields.
- **Supabase integration**: The Supabase schema can be wired in as an alternative or backup to MongoDB for certain resources.
- **Mobile / PWA**: The React app is visually optimized for mobile; turning it into a PWA would be a natural next step.
- **More moods & playlists**: Extend the CNN to more classes and enrich `genres.csv` with curated playlists per mood.

This README is meant to be the **single source of truth** for understanding how all parts of the Wellness Buddy project fit together. For backend‑only details and environment setup, also see `Server/README.md`.


