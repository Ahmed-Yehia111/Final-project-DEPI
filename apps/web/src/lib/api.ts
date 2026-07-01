export interface ModelInfo {
  name: string;
  modelVersion: string;
  architecture: string;
  inputShape: number[];
  preprocessing: string;
  output: string;
  defaultThreshold: number;
  classes: string[];
  disclaimer: string;
}

export interface PredictionResponse {
  label: "Normal" | "Pneumonia";
  pneumoniaProbability: number;
  normalProbability: number;
  threshold: number;
  heatmapPngBase64?: string;
  heatmapError?: string;
  model: ModelInfo;
}

export async function fetchModelInfo(): Promise<ModelInfo> {
  const response = await fetch("/api/model-info");
  const payload = await parseJson(response);
  return payload.data;
}

export async function requestPrediction(params: {
  file: File;
  threshold: number;
  includeHeatmap: boolean;
}): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.set("image", params.file);
  formData.set("threshold", String(params.threshold));
  formData.set("includeHeatmap", String(params.includeHeatmap));

  const response = await fetch("/api/predictions", {
    method: "POST",
    body: formData
  });

  const payload = await parseJson(response);
  return payload.data;
}

async function parseJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
