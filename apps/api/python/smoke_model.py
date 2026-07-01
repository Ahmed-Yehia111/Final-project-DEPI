import argparse
import base64
import math
import os
import tempfile
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
from PIL import Image
from tensorflow import keras

from preprocessing import preprocess_image


def main() -> None:
    parser = argparse.ArgumentParser(description="Load the PneumoScope model and run one synthetic prediction.")
    parser.add_argument("--model", required=True, help="Path to best_model_auc.keras")
    parser.add_argument("--heatmap", action="store_true", help="Also verify Grad-CAM overlay generation.")
    args = parser.parse_args()

    model_path = Path(args.model)
    if not model_path.exists():
        raise SystemExit(f"Model file was not found: {model_path}")

    model = keras.models.load_model(model_path, compile=False)

    with tempfile.TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "smoke_xray.png"
        synthetic = np.full((512, 512), 128, dtype=np.uint8)
        Image.fromarray(synthetic, mode="L").save(image_path)
        batch = preprocess_image(image_path)
        prediction = model.predict(batch, verbose=0)

        if args.heatmap:
            from gradcam import generate_gradcam

            encoded = generate_gradcam(model, batch)
            png = base64.b64decode(encoded)
            if not png.startswith(b"\x89PNG\r\n\x1a\n") or len(png) < 1024:
                raise SystemExit("Grad-CAM smoke test did not produce a valid PNG overlay.")

    probability = float(np.ravel(prediction)[0])
    if not math.isfinite(probability) or probability < 0.0 or probability > 1.0:
        raise SystemExit(f"Model returned an invalid probability: {probability}")

    heatmap_suffix = " heatmap=ok" if args.heatmap else ""
    print(f"Smoke prediction probability={probability:.6f}{heatmap_suffix}")


if __name__ == "__main__":
    main()
