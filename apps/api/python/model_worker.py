import json
import os
import sys
import traceback
from typing import Any, Dict

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")


def emit(message: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def log_error(message: str, error: BaseException) -> None:
    sys.stderr.write(f"{message}: {error}\n{traceback.format_exc()}\n")
    sys.stderr.flush()


def fail_start(error: BaseException) -> None:
    emit({"type": "fatal", "error": str(error), "trace": traceback.format_exc()})


try:
    import numpy as np
    from tensorflow import keras
    from gradcam import generate_gradcam
    from preprocessing import preprocess_image, probability_to_label
except BaseException as exc:
    fail_start(exc)
    raise SystemExit(1)


MODEL_PATH = os.environ.get("MODEL_PATH")
if not MODEL_PATH:
    fail_start(RuntimeError("MODEL_PATH is required."))
    raise SystemExit(1)

try:
    model = keras.models.load_model(MODEL_PATH, compile=False)
except BaseException as exc:
    fail_start(exc)
    raise SystemExit(1)

emit({"type": "ready"})


def handle_predict(message: Dict[str, Any]) -> Dict[str, Any]:
    image_batch = preprocess_image(message["imagePath"])
    prediction = model.predict(image_batch, verbose=0)
    probability = float(np.ravel(prediction)[0])
    threshold = float(message.get("threshold", 0.61))
    response: Dict[str, Any] = {
        "id": message["id"],
        "ok": True,
        "pneumoniaProbability": probability,
        "label": probability_to_label(probability, threshold),
    }

    if bool(message.get("includeHeatmap", False)):
        try:
            response["heatmapPngBase64"] = generate_gradcam(model, image_batch)
        except BaseException as exc:
            log_error("Grad-CAM generation failed", exc)
            response["heatmapError"] = "Grad-CAM overlay could not be generated for this image."

    return response


for raw_line in sys.stdin:
    try:
        payload = json.loads(raw_line)
        if payload.get("type") != "predict":
            emit({"id": payload.get("id", "unknown"), "ok": False, "error": "Unsupported worker command."})
            continue
        emit(handle_predict(payload))
    except BaseException as exc:
        emit({
            "id": payload.get("id", "unknown") if "payload" in locals() else "unknown",
            "ok": False,
            "error": str(exc),
            "trace": traceback.format_exc(),
        })
