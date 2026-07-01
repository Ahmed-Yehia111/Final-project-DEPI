export const DEFAULT_THRESHOLD = 0.61;

export type PredictionLabel = "Normal" | "Pneumonia";

export interface PredictionResult {
  label: PredictionLabel;
  pneumoniaProbability: number;
  normalProbability: number;
  threshold: number;
  heatmapPngBase64?: string;
  heatmapError?: string;
}

export function classifyPneumoniaProbability(
  pneumoniaProbability: number,
  threshold = DEFAULT_THRESHOLD
): PredictionLabel {
  return pneumoniaProbability > threshold ? "Pneumonia" : "Normal";
}

export function normalizeThreshold(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_THRESHOLD;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.05 || parsed > 0.95) {
    throw new Error("Threshold must be a number between 0.05 and 0.95.");
  }

  return parsed;
}
