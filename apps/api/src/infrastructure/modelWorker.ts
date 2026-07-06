import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import crypto from "node:crypto";
import readline from "node:readline";
import { ApiError } from "../shared/apiError";
import { config } from "../shared/config";
import { logger } from "../shared/logger";
import { downloadModel } from "./downloadModel";

const MODEL_WORKER_TIMEOUT_MS = 300_000;

interface WorkerRequest {
  imagePath: string;
  threshold: number;
  includeHeatmap: boolean;
}

interface WorkerResponse {
  id: string;
  ok: boolean;
  pneumoniaProbability?: number;
  heatmapPngBase64?: string;
  heatmapError?: string;
  error?: string;
}

interface PendingCall {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface ModelWorker {
  predict(request: WorkerRequest): Promise<{
    pneumoniaProbability: number;
    heatmapPngBase64?: string;
    heatmapError?: string;
  }>;
  getStatus(): Promise<"ready" | "missing-model" | "unavailable">;
}

export class PythonModelWorker implements ModelWorker {
  private process?: ChildProcessWithoutNullStreams;
  private startPromise?: Promise<void>;
  private pending = new Map<string, PendingCall>();
  private queue: Promise<unknown> = Promise.resolve();
  private resolvedModelPath?: string;

  async getStatus(): Promise<"ready" | "missing-model" | "unavailable"> {
    const modelPath = this.resolveModelPath();
    if (!modelPath) {
      return "missing-model";
    }

    try {
      await this.ensureStarted();
      return "ready";
    } catch (error) {
      logger.warn("Model worker is unavailable", { error: error instanceof Error ? error.message : String(error) });
      return "unavailable";
    }
  }

  async predict(request: WorkerRequest) {
    return this.enqueue(async () => {
      await this.ensureStarted();
      const id = crypto.randomUUID();
      const response = await this.send({
        id,
        type: "predict",
        imagePath: request.imagePath,
        threshold: request.threshold,
        includeHeatmap: request.includeHeatmap
      });

      if (!response.ok || typeof response.pneumoniaProbability !== "number") {
        throw new ApiError(502, response.error ?? "Model worker failed to produce a prediction.");
      }

      return {
        pneumoniaProbability: response.pneumoniaProbability,
        heatmapPngBase64: response.heatmapPngBase64,
        heatmapError: response.heatmapError
      };
    });
  }

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async ensureStarted(): Promise<void> {
    if (this.process && !this.process.killed) {
      return Promise.resolve();
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    const modelPath = this.resolveModelPath();
    if (!modelPath) {
      throw new ApiError(503, "Could not determine the model path.");
    }

    await downloadModel(modelPath);

    this.startPromise = new Promise((resolve, reject) => {
      const child = spawn(config.pythonBin, [config.workerScriptPath], {
        env: {
          ...process.env,
          MODEL_PATH: modelPath,
          PYTHONUNBUFFERED: "1",
          TF_CPP_MIN_LOG_LEVEL: "2"
        },
        stdio: ["pipe", "pipe", "pipe"]
      });

      this.process = child;

      const readyTimeout = setTimeout(() => {
        reject(new ApiError(503, "Timed out while loading the TensorFlow model."));
      }, MODEL_WORKER_TIMEOUT_MS);

      const lines = readline.createInterface({ input: child.stdout });
      lines.on("line", (line) => this.handleWorkerLine(line, resolve, reject, readyTimeout));

      child.stderr.on("data", (chunk) => {
        logger.warn("Model worker stderr", { message: chunk.toString().trim() });
      });

      child.on("exit", (code) => {
        logger.warn("Model worker exited", { code });
        this.process = undefined;
        this.startPromise = undefined;
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timeout);
          pending.reject(new ApiError(502, "Model worker exited before responding."));
        }
        this.pending.clear();
      });

      child.on("error", (error) => {
        clearTimeout(readyTimeout);
        this.startPromise = undefined;
        reject(new ApiError(503, `Could not start Python model worker: ${error.message}`));
      });
    });

    return this.startPromise;
  }

  private handleWorkerLine(
    line: string,
    resolveReady: () => void,
    rejectReady: (error: Error) => void,
    readyTimeout: NodeJS.Timeout
  ) {
    let message: WorkerResponse & { type?: string; error?: string };
    try {
      message = JSON.parse(line);
    } catch {
      logger.warn("Ignoring non-JSON worker stdout", { line });
      return;
    }

    if (message.type === "ready") {
      clearTimeout(readyTimeout);
      logger.info("Model worker ready");
      resolveReady();
      return;
    }

    if (message.type === "fatal") {
      clearTimeout(readyTimeout);
      rejectReady(new ApiError(503, message.error ?? "Model worker failed to start."));
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(message.id);
    pending.resolve(message);
  }

  private send(payload: Record<string, unknown>): Promise<WorkerResponse> {
    if (!this.process || this.process.killed) {
      throw new ApiError(503, "Model worker is not running.");
    }

    const id = String(payload.id);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new ApiError(504, "Model prediction timed out."));
      }, MODEL_WORKER_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timeout });
      this.process?.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pending.delete(id);
          reject(new ApiError(502, `Could not write to model worker: ${error.message}`));
        }
      });
    });
  }

  private resolveModelPath(): string {
    if (this.resolvedModelPath) {
      return this.resolvedModelPath;
    }

    this.resolvedModelPath = config.modelPath;
    return this.resolvedModelPath;
  }
}
