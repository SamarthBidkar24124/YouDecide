## Wellness Buddy Backend (FastAPI + MongoDB)

This directory contains a simple FastAPI backend that provides authentication for the Wellness Buddy app using MongoDB as the database.

### Setup

1. Create and activate a virtual environment (recommended):

```bash
cd Server
python -m venv .venv
.\.venv\Scripts\activate  # on Windows
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure environment variables:

Create a `.env` file in the `Server` directory with at least:

```bash
MONGODB_URI=mongodb://localhost:27017
DB_NAME=wellness_app
JWT_SECRET=change-this-secret
JWT_ALGORITHM=HS256
```

4. Run the server:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

### Auth Endpoints

- `POST /auth/register` – Register with `email` and `password`, returns `{ token, user }`.
- `POST /auth/login` – Login with `email` and `password`, returns `{ token, user }`.
- `GET /auth/me` – Get current user, requires `Authorization: Bearer <token>` header.


