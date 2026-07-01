import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  FileImage,
  FlameKindling,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Upload
} from "lucide-react";
import { fetchModelInfo, formatPercent, ModelInfo, PredictionResponse, requestPrediction } from "./lib/api";

const DEFAULT_THRESHOLD = 0.61;

export function App() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [includeHeatmap, setIncludeHeatmap] = useState(true);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchModelInfo()
      .then((info) => {
        setModelInfo(info);
        setThreshold(info.defaultThreshold);
      })
      .catch(() => setModelInfo(null));
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const riskTone = prediction?.label === "Pneumonia" ? "risk" : "clear";
  const heatmapUrl = prediction?.heatmapPngBase64 ? `data:image/png;base64,${prediction.heatmapPngBase64}` : null;
  const heatmapStatus = prediction?.heatmapError
    ? "Grad-CAM overlay could not be generated for this image."
    : "Overlay appears when requested and available.";

  const resultCopy = useMemo(() => {
    if (!prediction) {
      return "Awaiting scan";
    }
    return prediction.label === "Pneumonia" ? "Pneumonia signal above threshold" : "Below pneumonia threshold";
  }, [prediction]);

  function handleFile(nextFile: File | undefined) {
    if (!nextFile) {
      return;
    }
    setFile(nextFile);
    setPrediction(null);
    setError(null);
  }

  async function submitPrediction() {
    if (!file) {
      setError("Select a PNG or JPEG chest X-ray image.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPrediction({ file, threshold, includeHeatmap });
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files[0]);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Activity size={24} />
          </div>
          <div>
            <p className="eyebrow">ResNet-50 X-ray classifier</p>
            <h1>PneumoScope</h1>
          </div>
        </div>
        <div className="status-strip">
          <span>Threshold {threshold.toFixed(2)}</span>
          <span>{modelInfo?.modelVersion ? `Model ${modelInfo.modelVersion}` : "Model metadata"}</span>
        </div>
      </header>

      <section className="workspace">
        <div className="scan-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Input image</p>
              <h2>Chest X-ray</h2>
            </div>
            {file ? (
              <button className="icon-button ghost" onClick={() => setFile(null)} title="Clear image" type="button">
                <RefreshCw size={18} />
              </button>
            ) : null}
          </div>

          <label
            className={`dropzone ${isDragging ? "dragging" : ""} ${previewUrl ? "has-image" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <input accept="image/png,image/jpeg" type="file" onChange={onFileChange} />
            {previewUrl ? (
              <img src={previewUrl} alt="Selected chest X-ray preview" />
            ) : (
              <div className="empty-scan">
                <FileImage size={46} />
                <span>X-ray image</span>
                <strong>Select image</strong>
              </div>
            )}
          </label>

          <div className="control-rack">
            <div className="threshold-control">
              <div className="control-label">
                <SlidersHorizontal size={17} />
                <span>Classification threshold</span>
                <strong>{threshold.toFixed(2)}</strong>
              </div>
              <input
                min="0.05"
                max="0.95"
                step="0.01"
                type="range"
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
            </div>

            <label className="toggle-line">
              <input
                checked={includeHeatmap}
                type="checkbox"
                onChange={(event) => setIncludeHeatmap(event.target.checked)}
              />
              <FlameKindling size={17} />
              <span>Grad-CAM overlay</span>
            </label>
          </div>

          <button className="primary-action" disabled={!file || isLoading} onClick={submitPrediction} type="button">
            {isLoading ? <Loader2 className="spin" size={19} /> : <Upload size={19} />}
            <span>{isLoading ? "Running model" : "Run screening"}</span>
          </button>
          {error ? <p className="error-line">{error}</p> : null}
        </div>

        <div className="result-panel">
          <div className={`verdict ${riskTone}`}>
            <div className="verdict-topline">
              <span>{resultCopy}</span>
              {prediction?.label === "Pneumonia" ? <ShieldAlert size={22} /> : <Activity size={22} />}
            </div>
            <strong>{prediction ? prediction.label : "No result"}</strong>
            <p>{prediction ? `${formatPercent(prediction.pneumoniaProbability)} pneumonia probability` : "Result appears here after inference."}</p>
          </div>

          <div className="probability-grid">
            <ProbabilityBar
              label="Pneumonia"
              value={prediction?.pneumoniaProbability ?? 0}
              accent="var(--risk)"
            />
            <ProbabilityBar label="Normal" value={prediction?.normalProbability ?? 0} accent="var(--clear)" />
          </div>

          <div className="threshold-scale">
            <div className="scale-head">
              <span>Decision line</span>
              <strong>{formatPercent(threshold)}</strong>
            </div>
            <div className="scale-track">
              <span style={{ left: `${threshold * 100}%` }} />
            </div>
          </div>

          <div className="heatmap-panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Activation view</p>
                <h2>Grad-CAM</h2>
              </div>
              {prediction?.heatmapError ? <AlertTriangle size={20} /> : <ImagePlus size={20} />}
            </div>
            {heatmapUrl ? (
              <img src={heatmapUrl} alt="Grad-CAM activation overlay" />
            ) : (
              <div className="heatmap-empty">{heatmapStatus}</div>
            )}
          </div>

          <aside className="model-panel">
            <div>
              <p className="eyebrow">Model context</p>
              <h2>{modelInfo?.architecture ?? "ResNet-50 classifier"}</h2>
              <p>{modelInfo?.preprocessing ?? "512x512 RGB image with scaled pixels."}</p>
            </div>
            <img src="/threshold_optimization.png" alt="F1 score versus classification threshold" />
            <p className="disclaimer">
              {modelInfo?.disclaimer ??
                "This tool is for educational decision-support demonstration only and is not a medical diagnosis system."}
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ProbabilityBar({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="probability-row">
      <div className="row-label">
        <span>{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="meter">
        <span style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: accent }} />
      </div>
    </div>
  );
}
