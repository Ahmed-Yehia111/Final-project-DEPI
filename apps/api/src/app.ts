import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import { createApiRouter } from "./interfaces/http/routes";
import { PythonModelWorker } from "./infrastructure/modelWorker";
import { ApiError } from "./shared/apiError";
import { config } from "./shared/config";
import { logger } from "./shared/logger";

export function createApp(modelWorker = new PythonModelWorker()) {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter(modelWorker));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: `Image must be ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB or smaller.` });
      return;
    }

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ error: error.message, details: error.details });
      return;
    }

    if (error instanceof Error && error.message.startsWith("Threshold must")) {
      res.status(400).json({ error: error.message });
      return;
    }

    logger.error("Unhandled API error", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
