import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { classifyPneumoniaProbability, PredictionResult } from "../domain/prediction";
import { ModelWorker } from "../infrastructure/modelWorker";
import { validateUploadedImage } from "./imageValidation";

export interface PredictionRequest {
  file: Express.Multer.File | undefined;
  threshold: number;
  includeHeatmap: boolean;
}

export class PredictionService {
  constructor(private readonly modelWorker: ModelWorker) {}

  async predict(request: PredictionRequest): Promise<PredictionResult> {
    validateUploadedImage(request.file);

    const file = request.file;
    if (!file) {
      throw new Error("Image validation failed unexpectedly.");
    }

    const extension = file.originalname.split(".").pop()?.toLowerCase() === "png" ? "png" : "jpg";
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pneumoscope-"));
    const tempPath = path.join(tempDir, `${crypto.randomUUID()}.${extension}`);

    try {
      await fs.writeFile(tempPath, file.buffer);
      const workerResult = await this.modelWorker.predict({
        imagePath: tempPath,
        threshold: request.threshold,
        includeHeatmap: request.includeHeatmap
      });

      return {
        pneumoniaProbability: workerResult.pneumoniaProbability,
        normalProbability: 1 - workerResult.pneumoniaProbability,
        threshold: request.threshold,
        label: classifyPneumoniaProbability(workerResult.pneumoniaProbability, request.threshold),
        heatmapPngBase64: workerResult.heatmapPngBase64,
        heatmapError: workerResult.heatmapError
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
