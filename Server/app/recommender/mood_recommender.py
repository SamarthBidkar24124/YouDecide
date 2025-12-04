from pathlib import Path
from typing import List, Optional
from urllib.parse import quote_plus

import pandas as pd
from pydantic import BaseModel


# Project root (EDI@), e.g. C:/Users/mohan/Desktop/EDI@
BASE_DIR = Path(__file__).resolve().parents[3]

# Path to the precomputed audio-features dataset used for recommendations.
# On disk this lives at: <project_root>/Mood-Based-Song-Recommender-main/...
DATA_PATH = (
  BASE_DIR
  / "Mood-Based-Song-Recommender-main"
  / "Mood-Based-Song-Recommender-main"
  / "Data"
  / "genres.csv"
)


class Song(BaseModel):
  id: str
  name: str
  genre: Optional[str] = None
  uri: Optional[str] = None


try:
  _df = pd.read_csv(DATA_PATH)
except FileNotFoundError as exc:  # pragma: no cover - startup-time failure
  # Provide a clearer error message about where we expect the CSV to be.
  raise FileNotFoundError(
    f"genres.csv not found at '{DATA_PATH}'. "
    "Make sure the file exists at "
    "'Mood-Based-Song-Recommender-main/Mood-Based-Song-Recommender-main/Data/genres.csv' "
    "relative to the project root (EDI@)."
  ) from exc


def _filter_df_for_mood(mood: str) -> pd.DataFrame:
  """Filter the songs dataframe based on the detected mood using audio features."""
  mood_lower = mood.lower()

  if mood_lower == "happy":
    # High valence (happier sounding)
    return _df[_df["valence"] >= 0.6]
  if mood_lower == "sad":
    # Lower valence
    return _df[_df["valence"] <= 0.4]
  if mood_lower == "calm":
    # More acoustic, lower energy
    return _df[
      (_df["acousticness"] >= 0.5)
      & (_df["energy"] <= 0.6)
    ]
  if mood_lower == "angry":
    # High energy songs
    return _df[_df["energy"] >= 0.8]

  # Fallback if we ever get an unknown mood
  return _df


def recommend_songs_for_mood(mood: str, limit: int = 10) -> List[Song]:
  """
  Recommend a small set of songs for the given mood, using the existing
  genres.csv audio features dataset.
  """
  subset = _filter_df_for_mood(mood)

  if subset.empty:
    subset = _df

  if len(subset) > limit:
    subset = subset.sample(n=limit, random_state=None)

  songs: list[Song] = []
  for _, row in subset.iterrows():
    raw_name = row.get("song_name") or row.get("title") or ""
    name = str(raw_name).strip()
    if not name:
      continue

    song_id = str(row.get("id") or "")

    # Try to use a direct URI from the dataset if present.
    raw_uri = row.get("uri")
    uri = str(raw_uri).strip() if isinstance(raw_uri, str) else ""

    # If it looks like a Spotify URI, convert it to a web URL.
    if uri.startswith("spotify:track:"):
      spotify_id = uri.split("spotify:track:")[-1]
      uri = f"https://open.spotify.com/track/{spotify_id}"

    # If we still don't have a usable HTTP(S) URL, fall back to a YouTube search link.
    if not uri or not (uri.startswith("http://") or uri.startswith("https://")):
      search_query = quote_plus(f"{name} {row.get('artist', '')}".strip())
      uri = f"https://www.youtube.com/results?search_query={search_query}"

    raw_genre = row.get("genre")
    genre = str(raw_genre).strip() if isinstance(raw_genre, str) else None

    songs.append(
      Song(
        id=song_id,
        name=name,
        genre=genre or None,
        uri=uri or None,
      )
    )

  return songs


