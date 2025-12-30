import sharp from "sharp";

export function decodeBase64(base64) {
  return Buffer.from(base64, "base64");
}

export async function enhanceImageBuffer(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const maxDimension = 1920;

  let width = metadata.width;
  let height = metadata.height;

  if (width && height && (width > maxDimension || height > maxDimension)) {
    if (width > height) {
      width = maxDimension;
      height = Math.round((metadata.height / metadata.width) * maxDimension);
    } else {
      height = maxDimension;
      width = Math.round((metadata.width / metadata.height) * maxDimension);
    }
  }

  let pipeline = sharp(imageBuffer);
  if (width && height) {
    pipeline = pipeline.resize(width, height, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const enhancedBuffer = await pipeline
    .modulate({
      brightness: 1.05,
      saturation: 1.1,
    })
    .sharpen({
      sigma: 1,
      flat: 1,
      jagged: 2,
    })
    .normalize()
    .jpeg({
      quality: 85,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();

  const sizeReduction =
    imageBuffer.length > 0
      ? `${Math.round((1 - enhancedBuffer.length / imageBuffer.length) * 100)}%`
      : "0%";

  return {
    buffer: enhancedBuffer,
    base64: enhancedBuffer.toString("base64"),
    mimeType: "image/jpeg",
    width: width || metadata.width || null,
    height: height || metadata.height || null,
    originalWidth: metadata.width || null,
    originalHeight: metadata.height || null,
    sizeReduction,
  };
}
