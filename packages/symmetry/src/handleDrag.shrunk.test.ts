import { describe, expect, it } from 'vitest';
import { handleChange } from './handleDrag';
import { DEFAULT_SYMMETRY, type SymmetrySpec } from './kinds';

const free = { point: (p: { x: number; y: number }) => p, angle: (a: number) => a };
const center = { x: 0, y: 0 };

describe('handleChange, shrunk', () => {
  it('leaves a row handle dropped where it was pressed as it was, not at the rounded angle of the press', () => {
    const spec: SymmetrySpec = { ...DEFAULT_SYMMETRY, kind: 'wallpaper', angle: 0, spacing: -20, rowAngle: 0.924501370105996, rowSpacing: 20 };
    const at = { x: Math.cos(spec.rowAngle) * 20, y: Math.sin(spec.rowAngle) * 20 };
    expect(handleChange({ handle: 'row', group: 'g' }, { center, spec }, at, at, free)).toEqual({ spec: { rowAngle: spec.rowAngle, rowSpacing: 20 } });
  });

  it('leaves a step handle of a negative spacing dropped where it was pressed as it was, not turned a half turn', () => {
    const spec: SymmetrySpec = { ...DEFAULT_SYMMETRY, kind: 'repeat', angle: 0, spacing: -20 };
    const at = { x: -20, y: 0 };
    expect(handleChange({ handle: 'step', group: 'g' }, { center, spec }, at, at, free)).toEqual({ spec: { angle: 0, spacing: -20 } });
  });

  it('leaves the axis where it was when the knob, pressed off its line, is dropped where it was pressed', () => {
    const spec: SymmetrySpec = { ...DEFAULT_SYMMETRY, kind: 'mirror', angle: 0 };
    const at = { x: 64, y: 6 };
    expect(handleChange({ handle: 'angle', group: 'g' }, { center, spec }, at, at, free)).toEqual({ spec: { angle: 0 } });
  });
});
