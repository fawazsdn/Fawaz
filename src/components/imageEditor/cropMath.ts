/**
 * Pure crop geometry for the photo editor (unit-tested in __tests__).
 *
 * The image is shown "cover"-fitted inside a crop frame, then the user
 * zooms (scale >= 1) and pans (tx, ty in screen points, relative to the
 * centered position). We map the visible frame back to SOURCE pixels so the
 * final crop is done once, at full resolution, by expo-image-manipulator —
 * never by screenshotting or rescaling the preview, and never stretching.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export const MAX_ZOOM = 5;

/** Fits a frame of the given aspect (w/h) inside a box. */
export function fitFrame(aspect: number, box: Size): Size {
  if (box.width / box.height > aspect) return { width: box.height * aspect, height: box.height };
  return { width: box.width, height: box.width / aspect };
}

/** Scale at which the image exactly covers the frame (zoom = 1). */
export function coverScale(image: Size, frame: Size): number {
  return Math.max(frame.width / image.width, frame.height / image.height);
}

/** Max |tx|, |ty| so the image always fully covers the frame (no empty edges). */
export function panLimits(image: Size, frame: Size, zoom: number): { x: number; y: number } {
  const s = coverScale(image, frame) * zoom;
  return {
    x: Math.max(0, (image.width * s - frame.width) / 2),
    y: Math.max(0, (image.height * s - frame.height) / 2),
  };
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function clampTransform(image: Size, frame: Size, t: Transform): Transform {
  const scale = clamp(t.scale, 1, MAX_ZOOM);
  const lim = panLimits(image, frame, scale);
  return { scale, tx: clamp(t.tx, -lim.x, lim.x), ty: clamp(t.ty, -lim.y, lim.y) };
}

/** The crop rectangle in source-image pixels for the current transform. */
export function cropRect(image: Size, frame: Size, t: Transform) {
  const { scale, tx, ty } = clampTransform(image, frame, t);
  const s = coverScale(image, frame) * scale;
  const width = frame.width / s;
  const height = frame.height / s;
  // Frame center relative to image center, in image pixels (panning right moves the image right, i.e. the frame left).
  const cx = image.width / 2 - tx / s;
  const cy = image.height / 2 - ty / s;
  let originX = Math.round(cx - width / 2);
  let originY = Math.round(cy - height / 2);
  let w = Math.round(width);
  let h = Math.round(height);
  w = Math.min(w, image.width);
  h = Math.min(h, image.height);
  originX = clamp(originX, 0, image.width - w);
  originY = clamp(originY, 0, image.height - h);
  return { originX, originY, width: w, height: h };
}

/** Output size: keep the crop's exact aspect, cap the long edge (upload size/quality balance). */
export function outputSize(crop: { width: number; height: number }, maxLongEdge = 2048): Size | null {
  const long = Math.max(crop.width, crop.height);
  if (long <= maxLongEdge) return null;
  const k = maxLongEdge / long;
  return { width: Math.round(crop.width * k), height: Math.round(crop.height * k) };
}
