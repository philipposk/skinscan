/**
 * Client-side capture quality gate.
 *
 * The single biggest cause of a useless assessment is a bad photo, and the only
 * moment you can fix that is while the user is still standing in front of the
 * mirror. So we check in the browser, before upload, and tell them what to fix.
 *
 * These are cheap classical measures, not a model — they run in a few
 * milliseconds on a phone and they are honest about what they measure.
 */

export interface QualityReport {
  blur: number;        // variance of Laplacian, normalised 0-1; higher is sharper
  exposure: number;    // 0-1, distance of mean luminance from the ideal band
  glare: number;       // 0-1, fraction of blown-out pixels
  fill: number;        // 0-1, rough estimate of how much of the frame the subject fills
  usable: boolean;
  reasons: string[];
}

const MIN_EDGE = 640;

export async function analyseImage(file: File | Blob): Promise<QualityReport> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { blur: 1, exposure: 1, glare: 0, fill: 1, usable: true, reasons: [] };
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Greyscale
  const grey = new Float32Array(w * h);
  let sum = 0;
  let blown = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    grey[p] = v;
    sum += v;
    if (v > 250) blown++;
  }
  const mean = sum / grey.length;

  // Variance of the Laplacian — the standard cheap sharpness measure.
  let lapSum = 0;
  let lapSqSum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - w] - grey[i + w];
      lapSum += lap;
      lapSqSum += lap * lap;
      n++;
    }
  }
  const lapMean = lapSum / n;
  const variance = lapSqSum / n - lapMean * lapMean;

  // ~100 is the widely used "blurry" cutoff for this measure at this scale.
  const blur = Math.min(1, variance / 300);
  const glare = blown / grey.length;

  // Ideal mean luminance sits around 110-170; punish drift either way.
  const exposure = 1 - Math.min(1, Math.abs(mean - 140) / 90);

  // Crude subject-fill proxy: how much of the frame differs from the border
  // colour. A photo taken from two metres away scores low.
  let edgeMean = 0;
  let edgeCount = 0;
  for (let x = 0; x < w; x++) {
    edgeMean += grey[x] + grey[(h - 1) * w + x];
    edgeCount += 2;
  }
  edgeMean /= edgeCount;
  let differing = 0;
  for (let i = 0; i < grey.length; i++) if (Math.abs(grey[i] - edgeMean) > 25) differing++;
  const fill = differing / grey.length;

  const reasons: string[] = [];
  if (Math.max(bitmap.width, bitmap.height) < MIN_EDGE) {
    reasons.push("The photo is quite low resolution. Use your main camera rather than a screenshot or a zoomed crop.");
  }
  if (blur < 0.25) reasons.push("It looks out of focus. Tap the spot on screen to focus, then hold still.");
  if (exposure < 0.35 && mean < 140) reasons.push("It is too dark. Move next to a window — daylight works far better than a ceiling light.");
  if (exposure < 0.35 && mean >= 140) reasons.push("It is overexposed. Turn the flash off and step out of direct sun.");
  if (glare > 0.06) reasons.push("There is a bright glare spot. Turn the flash off and angle away from the light.");
  if (fill < 0.08) reasons.push("You are too far away. Fill the frame with the spot — about 10 to 15cm from the skin.");

  bitmap.close?.();

  return {
    blur: Number(blur.toFixed(3)),
    exposure: Number(exposure.toFixed(3)),
    glare: Number(glare.toFixed(4)),
    fill: Number(fill.toFixed(3)),
    usable: reasons.length === 0,
    reasons,
  };
}

/** Downscale + strip metadata before upload. EXIF GPS never leaves the device. */
export async function prepareForUpload(file: File | Blob, maxEdge = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  // Re-encoding through a canvas drops every EXIF tag, including GPS.
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.92),
  );
}
