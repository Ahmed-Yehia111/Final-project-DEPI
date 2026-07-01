import { createApp } from "./app";
import { config } from "./shared/config";
import { logger } from "./shared/logger";

const app = createApp();

app.listen(config.apiPort, () => {
  logger.info("PneumoScope API listening", {
    port: config.apiPort,
    modelPath: config.modelPath,
    fallbackModelPath: config.fallbackModelPath
  });
});
