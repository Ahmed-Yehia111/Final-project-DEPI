import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { PredictionController } from "./predictionController";
import { ModelWorker } from "../../infrastructure/modelWorker";
import { PredictionService } from "../../application/predictionService";
import { config } from "../../shared/config";
import { modelInfo } from "./modelInfo";

export function createApiRouter(modelWorker: ModelWorker) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes }
  });
  const predictionController = new PredictionController(new PredictionService(modelWorker));

  router.get("/health", async (_req, res) => {
    const modelStatus = await modelWorker.getStatus();
    res.status(modelStatus === "ready" ? 200 : 503).json({
      data: {
        status: modelStatus === "ready" ? "ok" : "degraded",
        modelStatus
      }
    });
  });

  router.get("/model-info", (_req, res) => {
    res.json({ data: modelInfo });
  });

  router.post("/predictions", upload.single("image"), asyncHandler(predictionController.predict));

  return router;
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
