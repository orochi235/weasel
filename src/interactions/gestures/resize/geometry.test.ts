import { describe, expect, it } from 'vitest';
import { RECT_POSE_DESCRIPTOR, ROTATED_POSE_DESCRIPTOR, type PoseDescriptor } from './geometry';
import type { ResizePose, RotatedPose } from '../types';

describe('RECT_POSE_DESCRIPTOR.getBounds', () => {
  it('returns the pose itself (identity projection)', () => {
    const pose: ResizePose = { x: 3, y: 4, width: 10, height: 20 };
    expect(RECT_POSE_DESCRIPTOR.getBounds(pose)).toBe(pose);
  });
});

describe('RECT_POSE_DESCRIPTOR.remapBounds', () => {
  it('identity remap (src === dst) returns equivalent pose', () => {
    const pose: ResizePose = { x: 3, y: 4, width: 10, height: 20 };
    const bounds: ResizePose = { x: 0, y: 0, width: 100, height: 100 };
    expect(RECT_POSE_DESCRIPTOR.remapBounds(pose, bounds, bounds)).toEqual(pose);
  });

  it('uniform scale: 2x scales position-from-origin and size by 2', () => {
    const pose: ResizePose = { x: 5, y: 10, width: 20, height: 30 };
    const src: ResizePose = { x: 0, y: 0, width: 100, height: 100 };
    const dst: ResizePose = { x: 0, y: 0, width: 200, height: 200 };
    expect(RECT_POSE_DESCRIPTOR.remapBounds(pose, src, dst)).toEqual({
      x: 10,
      y: 20,
      width: 40,
      height: 60,
    });
  });

  it('asymmetric scale: width and height scale independently', () => {
    const pose: ResizePose = { x: 10, y: 10, width: 20, height: 20 };
    const src: ResizePose = { x: 0, y: 0, width: 100, height: 50 };
    const dst: ResizePose = { x: 0, y: 0, width: 300, height: 100 };
    expect(RECT_POSE_DESCRIPTOR.remapBounds(pose, src, dst)).toEqual({
      x: 30,
      y: 20,
      width: 60,
      height: 40,
    });
  });

  it('pure translation: same size, shifted origin', () => {
    const pose: ResizePose = { x: 5, y: 5, width: 10, height: 10 };
    const src: ResizePose = { x: 0, y: 0, width: 100, height: 100 };
    const dst: ResizePose = { x: 50, y: -20, width: 100, height: 100 };
    expect(RECT_POSE_DESCRIPTOR.remapBounds(pose, src, dst)).toEqual({
      x: 55,
      y: -15,
      width: 10,
      height: 10,
    });
  });

  it('scale-from-non-origin: relative position within src is preserved', () => {
    const pose: ResizePose = { x: 60, y: 60, width: 20, height: 20 };
    const src: ResizePose = { x: 50, y: 50, width: 100, height: 100 };
    const dst: ResizePose = { x: 0, y: 0, width: 200, height: 200 };
    expect(RECT_POSE_DESCRIPTOR.remapBounds(pose, src, dst)).toEqual({
      x: 20,
      y: 20,
      width: 40,
      height: 40,
    });
  });

  it('preserves extra pose fields via spread', () => {
    interface Extended extends ResizePose {
      label: string;
      rotation: number;
    }
    const pose: Extended = { x: 0, y: 0, width: 10, height: 10, label: 'a', rotation: 45 };
    const src: ResizePose = { x: 0, y: 0, width: 10, height: 10 };
    const dst: ResizePose = { x: 0, y: 0, width: 20, height: 20 };
    const out = RECT_POSE_DESCRIPTOR.remapBounds(pose, src, dst) as Extended;
    expect(out.label).toBe('a');
    expect(out.rotation).toBe(45);
    expect(out.width).toBe(20);
  });

  it('zero-width src: x-axis scale is 1 (no NaN), y-axis still scales', () => {
    const pose: ResizePose = { x: 5, y: 10, width: 0, height: 20 };
    const src: ResizePose = { x: 5, y: 0, width: 0, height: 100 };
    const dst: ResizePose = { x: 50, y: 0, width: 200, height: 200 };
    const out = RECT_POSE_DESCRIPTOR.remapBounds(pose, src, dst);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.width)).toBe(true);
    expect(out).toEqual({ x: 50, y: 20, width: 0, height: 40 });
  });

  it('zero-height src: y-axis scale is 1 (no NaN), x-axis still scales', () => {
    const pose: ResizePose = { x: 10, y: 5, width: 20, height: 0 };
    const src: ResizePose = { x: 0, y: 5, width: 100, height: 0 };
    const dst: ResizePose = { x: 0, y: 50, width: 200, height: 200 };
    const out = RECT_POSE_DESCRIPTOR.remapBounds(pose, src, dst);
    expect(Number.isFinite(out.y)).toBe(true);
    expect(Number.isFinite(out.height)).toBe(true);
    expect(out).toEqual({ x: 20, y: 50, width: 40, height: 0 });
  });

  it('zero-width and zero-height src: both axes pass-through translated to dst', () => {
    const pose: ResizePose = { x: 5, y: 5, width: 0, height: 0 };
    const src: ResizePose = { x: 5, y: 5, width: 0, height: 0 };
    const dst: ResizePose = { x: 100, y: 200, width: 50, height: 50 };
    expect(RECT_POSE_DESCRIPTOR.remapBounds(pose, src, dst)).toEqual({
      x: 100,
      y: 200,
      width: 0,
      height: 0,
    });
  });
});

describe('RECT_POSE_DESCRIPTOR type inference', () => {
  it('works with any TPose extending ResizePose via unknown cast (matches useResize call site)', () => {
    interface RichPose extends ResizePose {
      kind: 'rect';
      meta: { tag: string };
    }
    const geom = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<RichPose>;
    const pose: RichPose = {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      kind: 'rect',
      meta: { tag: 't' },
    };
    const out = geom.remapBounds(
      pose,
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 0, width: 20, height: 20 },
    );
    expect(out.kind).toBe('rect');
    expect(out.meta).toEqual({ tag: 't' });
    expect(out.width).toBe(20);
    expect(geom.getBounds(pose)).toBe(pose);
  });
});

describe('ROTATED_POSE_DESCRIPTOR', () => {
  const pose: RotatedPose = { x: 5, y: 6, width: 10, height: 20, rotation: Math.PI / 3 };

  it('getRotation reads pose.rotation', () => {
    expect(ROTATED_POSE_DESCRIPTOR.getRotation!(pose)).toBe(Math.PI / 3);
  });

  it('getBounds reads x/y/width/height (rotation ignored)', () => {
    const bounds = ROTATED_POSE_DESCRIPTOR.getBounds(pose);
    expect(bounds.x).toBe(5);
    expect(bounds.y).toBe(6);
    expect(bounds.width).toBe(10);
    expect(bounds.height).toBe(20);
  });

  it('remapBounds preserves rotation field across rect→rect remap', () => {
    const src = { x: 5, y: 6, width: 10, height: 20 };
    const dst = { x: 0, y: 0, width: 20, height: 40 };
    const out = ROTATED_POSE_DESCRIPTOR.remapBounds(pose, src, dst);
    expect(out.rotation).toBe(Math.PI / 3);
    expect(out.x).toBe(0);
    expect(out.width).toBe(20);
  });

  it('translate preserves rotation field', () => {
    const out = ROTATED_POSE_DESCRIPTOR.translate!(pose, 1, 2);
    expect(out.rotation).toBe(Math.PI / 3);
    expect(out.x).toBe(6);
    expect(out.y).toBe(8);
  });
});
