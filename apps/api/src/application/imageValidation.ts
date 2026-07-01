import { ApiError } from "../shared/apiError";

const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);
const allowedExtensions = new Set(["jpg", "jpeg", "png"]);

export function validateUploadedImage(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new ApiError(400, "Upload an X-ray image using the `image` field.");
  }

  const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    throw new ApiError(415, "Only PNG and JPEG images are supported.");
  }

  if (!hasValidImageSignature(file.buffer)) {
    throw new ApiError(415, "The uploaded file does not look like a valid PNG or JPEG image.");
  }
}

export function hasValidImageSignature(buffer: Buffer): boolean {
  if (buffer.length < 8) {
    return false;
  }

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  return isPng || isJpeg;
}
