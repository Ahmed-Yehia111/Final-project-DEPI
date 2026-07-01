import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { hasValidImageSignature } from "../src/application/imageValidation";
import { classifyPneumoniaProbability, normalizeThreshold } from "../src/domain/prediction";
import { ModelWorker } from "../src/infrastructure/modelWorker";

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d
]);

describe("prediction domain", () => {
  it("classifies probabilities against the selected threshold", () => {
    expect(classifyPneumoniaProbability(0.62, 0.61)).toBe("Pneumonia");
    expect(classifyPneumoniaProbability(0.61, 0.61)).toBe("Normal");
  });

  it("normalizes valid thresholds and rejects invalid values", () => {
    expect(normalizeThreshold(undefined)).toBe(0.61);
    expect(normalizeThreshold("0.42")).toBe(0.42);
    expect(() => normalizeThreshold("1.5")).toThrow("Threshold must");
  });
});

describe("image validation", () => {
  it("accepts PNG signatures and rejects text buffers", () => {
    expect(hasValidImageSignature(pngBuffer)).toBe(true);
    expect(hasValidImageSignature(Buffer.from("not an image"))).toBe(false);
  });
});

describe("prediction API", () => {
  const mockWorker: ModelWorker = {
    getStatus: async () => "ready",
    predict: async () => ({
      pneumoniaProbability: 0.72,
      heatmapPngBase64: "fake-heatmap"
    })
  };

  it("returns a prediction with model metadata", async () => {
    const response = await request(createApp(mockWorker))
      .post("/api/predictions")
      .field("threshold", "0.61")
      .field("includeHeatmap", "true")
      .attach("image", pngBuffer, {
        filename: "xray.png",
        contentType: "image/png"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.label).toBe("Pneumonia");
    expect(response.body.data.pneumoniaProbability).toBe(0.72);
    expect(response.body.data.model.defaultThreshold).toBe(0.61);
  });

  it("rejects non-image uploads", async () => {
    const response = await request(createApp(mockWorker))
      .post("/api/predictions")
      .attach("image", Buffer.from("plain text"), {
        filename: "notes.txt",
        contentType: "text/plain"
      });

    expect(response.status).toBe(415);
  });
});
