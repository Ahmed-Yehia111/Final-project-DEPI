import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { formatPercent } from "./lib/api";

describe("formatPercent", () => {
  it("formats probabilities with one decimal place", () => {
    expect(formatPercent(0.724)).toBe("72.4%");
  });
});

describe("App", () => {
  it("renders the PneumoScope workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            name: "PneumoScope ResNet-50 Pneumonia Detector",
            modelVersion: "2.0",
            architecture: "ResNet-50 with sigmoid classification head",
            inputShape: [512, 512, 3],
            preprocessing: "RGB image resized to 512x512 with pixel values scaled to 0-1.",
            output: "Single sigmoid pneumonia probability.",
            defaultThreshold: 0.61,
            classes: ["Normal", "Pneumonia"],
            disclaimer: "Demo only."
          }
        })
      }))
    );

    render(<App />);

    expect(await screen.findByText("PneumoScope")).toBeInTheDocument();
    expect(screen.getByText("Chest X-ray")).toBeInTheDocument();
    expect(screen.getByText("No result")).toBeInTheDocument();
  });
});
