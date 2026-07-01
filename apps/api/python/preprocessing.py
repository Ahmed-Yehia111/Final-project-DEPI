from pathlib import Path

import numpy as np
from PIL import Image


def preprocess_image(image_path: str | Path) -> np.ndarray:
    image = Image.open(image_path).convert("RGB")
    image = image.resize((512, 512))
    array = np.asarray(image, dtype=np.float32) / 255.0
    return np.expand_dims(array, axis=0)


def probability_to_label(probability: float, threshold: float) -> str:
    return "Pneumonia" if probability > threshold else "Normal"
