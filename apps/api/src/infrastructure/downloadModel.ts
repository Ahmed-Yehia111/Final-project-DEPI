import axios from "axios";
import fs from "node:fs";
import path from "node:path";

const MODEL_URL = process.env.MODEL_URL!;

export async function downloadModel(modelPath: string) {
  if (fs.existsSync(modelPath)) {
    return;
  }

  if (!MODEL_URL) {
    throw new Error("MODEL_URL environment variable is missing.");
  }

  fs.mkdirSync(path.dirname(modelPath), { recursive: true });

  const response = await axios({
    url: MODEL_URL,
    method: "GET",
    responseType: "stream"
  });

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(modelPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  console.log("Model downloaded successfully.");
}
