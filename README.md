# PneumoScope

PneumoScope is a local-first web app for running a trained ResNet-50 pneumonia detector against chest X-ray images. It provides an Express API, a persistent Python/TensorFlow worker, and a React TypeScript UI.

This project is for educational and decision-support demonstration only. It is not a medical diagnosis system.

## What The Model Expects

- Keras model: `best_model_auc.keras`
- Input: `512x512x3`
- Preprocessing: RGB image resized to `512x512`, pixel values divided by `255.0`
- Output: one sigmoid probability for pneumonia
- Default threshold: `0.61`

## Local Setup

### Prerequisites

- Node.js 20+
- Python 3.10, 3.11, or 3.12

### Private Weights

The model weights are private and are not included in GitHub. Before setup, place the project owner's private file here:

```text
model-artifacts/best_model_auc.keras
```

Do not commit `.keras`, `.h5`, `.tflite`, zip, or training artifact files.

### One-Command Setup

Run this from the project root in PowerShell:

```powershell
.\scripts\setup.ps1
```

The script installs JavaScript dependencies, creates `apps/api/.venv`, installs Python/TensorFlow dependencies, writes `.env`, verifies the private weights, and runs a real model smoke test.

Then start the app:

```powershell
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to `http://localhost:4100`.

### Rerunning Setup

It is safe to run `.\scripts\setup.ps1` repeatedly. It reuses the existing virtual environment, skips Python dependency installation when `requirements.txt` has not changed, rechecks the weights, and reruns the model smoke test.

## Deployment Notes

The model file is about 389 MB. Do not commit it to normal Git history. GitHub enforces a 100 MB single-object limit for regular repository files, so publish this repository as source code only unless you intentionally configure private external model storage.

Good deployment options later:

- GitHub source repo + local model file for demos.
- GitHub LFS for the model, with storage and bandwidth tracking.
- Cloud Run with Docker, 2-4 GiB memory, concurrency set to 1, and model download from Cloud Storage or Hugging Face at startup.
- Hugging Face model storage for the weights, then have the service download/cache the artifact.

## Project Layout

```text
apps/api   Express API and Python TensorFlow worker
apps/web   React TypeScript UI
model-artifacts   Local-only model placement
```
