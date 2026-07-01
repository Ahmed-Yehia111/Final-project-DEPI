import path from "node:path";
import dotenv from "dotenv";

const repoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(repoRoot, ".env") });
dotenv.config();

const defaultModelPath = path.resolve(repoRoot, "model-artifacts/best_model_auc.keras");
const trainingModelPath = path.resolve(repoRoot, "model-training-files/Project/best_model_auc.keras");
const envModelPath = process.env.MODEL_PATH
  ? path.isAbsolute(process.env.MODEL_PATH)
    ? process.env.MODEL_PATH
    : path.resolve(repoRoot, process.env.MODEL_PATH)
  : defaultModelPath;
const envPythonBin = process.env.PYTHON_BIN ?? "python";
const resolvedPythonBin =
  envPythonBin.includes("/") || envPythonBin.includes("\\")
    ? path.isAbsolute(envPythonBin)
      ? envPythonBin
      : path.resolve(repoRoot, envPythonBin)
    : envPythonBin;

export const config = {
  env: process.env.NODE_ENV ?? "development",
  apiPort: Number(process.env.API_PORT ?? 4100),
  pythonBin: resolvedPythonBin,
  modelPath: envModelPath,
  fallbackModelPath: trainingModelPath,
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
  workerScriptPath: path.resolve(__dirname, "../../python/model_worker.py"),
  modelVersion: "2.0",
  defaultThreshold: 0.61
};
