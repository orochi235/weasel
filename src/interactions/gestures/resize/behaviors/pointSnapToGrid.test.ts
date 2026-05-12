import { describe, expect, it } from 'vitest';
import { pointSnapToGrid } from './pointSnapToGrid';

const baseCtx = {
  draggedCorner: { worldX: 123, worldY: 47 },
  fixedCorner: { worldX: 0, worldY: 0 },
  center: { worldX: 50, worldY: 30 },
  origin: { worldX: 0, worldY: 0 },
  rotation: 0,
  anchor: { x: 'min' as const, y: 'min' as const },
  proposed: { x: 0, y: 0, width: 123, height: 47 },
  modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
};

describe('pointSnapToGrid', () => {
  it('default frame is dragged-corner; rounds to spacing', () => {
    const b = pointSnapToGrid({ spacing: 50 });
    expect(b.onMove(baseCtx)).toEqual({ frame: 'dragged-corner', worldX: 100, worldY: 50 });
  });

  it('honors explicit frame option', () => {
    const b = pointSnapToGrid({ spacing: 20, frame: 'center' });
    expect(b.onMove(baseCtx)).toEqual({ frame: 'center', worldX: 60, worldY: 40 });
  });

  it('returns null when draggedCorner is null and frame is dragged-corner', () => {
    const b = pointSnapToGrid({ spacing: 50 });
    const ctx = { ...baseCtx, draggedCorner: null };
    expect(b.onMove(ctx)).toBeNull();
  });

  it('bypassKey suppresses snap', () => {
    const b = pointSnapToGrid({ spacing: 50, bypassKey: 'meta' });
    const ctx = { ...baseCtx, modifiers: { ...baseCtx.modifiers, meta: true } };
    expect(b.onMove(ctx)).toBeNull();
  });
});
