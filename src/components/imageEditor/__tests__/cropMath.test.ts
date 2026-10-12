import { clampTransform, coverScale, cropRect, fitFrame, outputSize } from '../cropMath';

const image = { width: 4000, height: 3000 }; // 4:3 iPhone photo

describe('crop math (no distortion, full-resolution crops)', () => {
  it('fits the frame to the requested aspect', () => {
    expect(fitFrame(1, { width: 350, height: 500 })).toEqual({ width: 350, height: 350 });
    const wide = fitFrame(16 / 9, { width: 350, height: 500 });
    expect(wide.width / wide.height).toBeCloseTo(16 / 9);
  });

  it('centered square crop at zoom 1 uses the full image height and keeps the exact aspect', () => {
    const frame = { width: 300, height: 300 };
    expect(cropRect(image, frame, { scale: 1, tx: 0, ty: 0 })).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
  });

  it('zooming in crops a smaller region at source resolution', () => {
    const frame = { width: 300, height: 300 };
    const r = cropRect(image, frame, { scale: 2, tx: 0, ty: 0 });
    expect([r.width, r.height, r.originX]).toEqual([1500, 1500, 1250]);
  });

  it('panning moves the crop window the opposite way and never leaves the image', () => {
    const frame = { width: 300, height: 300 };
    const s = coverScale(image, frame);
    expect(cropRect(image, frame, { scale: 1, tx: 50, ty: 0 }).originX).toBe(Math.round(500 - 50 / s));
    const extreme = cropRect(image, frame, { scale: 1, tx: 99999, ty: 99999 });
    expect([extreme.originX, extreme.originY]).toEqual([0, 0]);
  });

  it('clamps zoom to [1, 5]', () => {
    const frame = { width: 300, height: 300 };
    expect(clampTransform(image, frame, { scale: 0.2, tx: 0, ty: 0 }).scale).toBe(1);
    expect(clampTransform(image, frame, { scale: 50, tx: 0, ty: 0 }).scale).toBe(5);
  });

  it('caps output size while preserving the crop aspect', () => {
    const out = outputSize({ width: 3000, height: 1688 })!;
    expect(Math.max(out.width, out.height)).toBe(2048);
    expect(out.width / out.height).toBeCloseTo(3000 / 1688, 2);
    expect(outputSize({ width: 1200, height: 900 })).toBeNull();
  });
});
