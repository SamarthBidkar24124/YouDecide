from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from tensorflow.keras.layers import Conv2D, Dense, Dropout, Flatten, MaxPooling2D
from tensorflow.keras.models import Sequential


# Project root (EDI@), e.g. C:/Users/mohan/Desktop/EDI@
BASE_DIR = Path(__file__).resolve().parents[3]
MODEL_DIR = (
  BASE_DIR
  / "Mood-Based-Song-Recommender-main"
  / "Mood-Based-Song-Recommender-main"
  / "Model"
)
WEIGHTS_PATH = MODEL_DIR / "model_weights_training_optimal.h5"

_EMOTION_DICT: dict[int, str] = {
  0: "Angry",
  1: "Sad",
  2: "Happy",
  3: "Calm",
}

_model: Optional[Sequential] = None


def _build_model() -> Sequential:
  """Create the CNN architecture and load pre-trained weights."""
  model = Sequential()
  model.add(
    Conv2D(
      32,
      kernel_size=(3, 3),
      activation="relu",
      input_shape=(48, 48, 1),
    )
  )
  model.add(Conv2D(64, kernel_size=(3, 3), activation="relu"))
  model.add(MaxPooling2D(pool_size=(2, 2)))
  model.add(Dropout(0.25))

  model.add(Conv2D(128, kernel_size=(3, 3), activation="relu"))
  model.add(MaxPooling2D(pool_size=(2, 2)))
  model.add(Conv2D(128, kernel_size=(3, 3), activation="relu"))
  model.add(MaxPooling2D(pool_size=(2, 2)))
  model.add(Dropout(0.25))

  model.add(Flatten())
  model.add(Dense(1024, activation="relu"))
  model.add(Dropout(0.5))
  model.add(Dense(4, activation="softmax"))

  if not WEIGHTS_PATH.exists():
    raise FileNotFoundError(
      f"Emotion model weights not found at {WEIGHTS_PATH}. "
      "Make sure the 'Mood-Based-Song-Recommender-main' project (with the "
      "'Model/model_weights_training_optimal.h5' file) exists under the "
      "project root (EDI@)."
    )

  model.load_weights(str(WEIGHTS_PATH))
  return model


def _get_model() -> Sequential:
  global _model
  if _model is None:
    _model = _build_model()
  return _model


def predict_mood_from_image_bytes(image_bytes: bytes) -> str:
  """
  Decode an image from bytes, run face detection and emotion prediction,
  and return one of: Angry, Sad, Happy, Calm.
  """
  if not image_bytes:
    raise ValueError("Empty image bytes.")

  # Decode JPEG/PNG bytes into an OpenCV BGR image
  file_array = np.frombuffer(image_bytes, dtype=np.uint8)
  frame = cv2.imdecode(file_array, cv2.IMREAD_COLOR)

  if frame is None:
    raise ValueError("Could not decode image data.")

  cv2.ocl.setUseOpenCL(False)

  gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
  facecasc = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
  )

  faces = facecasc.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

  if len(faces) == 0:
    # Fallback: use the center crop of the image if no face is detected.
    h, w = gray.shape
    size = min(h, w)
    y0 = (h - size) // 2
    x0 = (w - size) // 2
    roi_gray = gray[y0 : y0 + size, x0 : x0 + size]
  else:
    x, y, w, h = faces[0]
    roi_gray = gray[y : y + h, x : x + w]

  roi_resized = cv2.resize(roi_gray, (48, 48))
  cropped_img = np.expand_dims(np.expand_dims(roi_resized, -1), 0)

  model = _get_model()
  prediction = model.predict(cropped_img, verbose=0)
  maxindex = int(np.argmax(prediction))
  return _EMOTION_DICT.get(maxindex, "Calm")


