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

### Azure App Service Deployment

This repository includes Azure-ready deployment config:

- `Dockerfile` builds the React app, Express API, and Python/TensorFlow worker into one Linux container.
- `infra/main.bicep` provisions Azure Container Registry, an App Service plan, a Linux Web App for Containers, app settings, and the managed identity permission needed for App Service to pull from ACR.
- `.github/workflows/main_pneumoscope.yml` validates the app, provisions Azure resources, builds the container in ACR, and deploys the image to App Service.

Required GitHub secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` for Azure OIDC login. The workflow also supports the existing Azure-generated `AZUREAPPSERVICE_*` secret names already present in this repo.
- `MODEL_URL`, a private HTTPS URL for `best_model_auc.keras`, such as an Azure Blob SAS URL. The API downloads it on first model use into `/home/site/wwwroot/model-artifacts/best_model_auc.keras`.

Optional GitHub variables:

- `AZURE_RESOURCE_GROUP` defaults to `rg-pneumoscope`.
- `AZURE_LOCATION` defaults to `eastus`.
- `AZURE_WEBAPP_NAME` defaults to `pneumoscope` and must be globally unique.

The App Service plan defaults to `P1v3` because TensorFlow needs enough memory to load the model. You can override `appServiceSkuName` and `appServiceSkuTier` in `infra/main.bicep` parameters if cost or capacity needs change.

Persistent App Service storage is enabled so the downloaded model file remains under `/home/site/wwwroot` across restarts.

Other deployment options:

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
