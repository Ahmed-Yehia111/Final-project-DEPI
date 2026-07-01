import { Request, Response } from "express";
import { PredictionService } from "../../application/predictionService";
import { normalizeThreshold } from "../../domain/prediction";
import { modelInfo } from "./modelInfo";

export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  predict = async (req: Request, res: Response) => {
    const threshold = normalizeThreshold(req.body.threshold);
    const includeHeatmap = parseBoolean(req.body.includeHeatmap);
    const result = await this.predictionService.predict({
      file: req.file,
      threshold,
      includeHeatmap
    });

    res.json({
      data: {
        ...result,
        model: modelInfo
      }
    });
  };
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }

  return false;
}
