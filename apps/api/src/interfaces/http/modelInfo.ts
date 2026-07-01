import { config } from "../../shared/config";

export const modelInfo = {
  name: "PneumoScope ResNet-50 Pneumonia Detector",
  modelVersion: config.modelVersion,
  architecture: "ResNet-50 with sigmoid classification head",
  inputShape: [512, 512, 3],
  preprocessing: "RGB image resized to 512x512 with pixel values scaled to 0-1.",
  output: "Single sigmoid pneumonia probability.",
  defaultThreshold: config.defaultThreshold,
  classes: ["Normal", "Pneumonia"],
  disclaimer:
    "This tool is for educational decision-support demonstration only and is not a medical diagnosis system."
};
