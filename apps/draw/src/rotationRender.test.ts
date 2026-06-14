import { describe, it, expect } from 'vitest';
import { wrapWithRotation } from './rotationRender';
import type { DrawCommand } from '@weasel-js/core/renderer';

describe('wrapWithRotation', () => {
  const inner: DrawCommand[] = [
    { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: '#f00' } },
  ];

  it('returns inner unchanged when rotation is undefined', () => {
    const out = wrapWithRotation(inner, { x: 0, y: 0, width: 10, height: 10 });
    expect(out).toBe(inner);
  });

  it('returns inner unchanged when rotation is 0', () => {
    const out = wrapWithRotation(inner, { x: 0, y: 0, width: 10, height: 10, rotation: 0 });
    expect(out).toBe(inner);
  });

  it('wraps inner in a group with a rotation transform when rotation is non-zero', () => {
    const out = wrapWithRotation(inner, { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 2 });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('group');
    const group = out[0] as Extract<DrawCommand, { kind: 'group' }>;
    expect(group.transform).toBeDefined();
    expect(group.children).toBe(inner);
  });

  it('rotates a corner point about the AABB center as expected', () => {
    // Math-convention rotation `[c -s; s c]` (matches kit's useRotate /
    // RotateDemo). Rotating by +π/2 about (5, 5) maps (0, 0) → (10, 0):
    //   relative (-5,-5) → (-5*0 - -5*1, -5*1 + -5*0) = (5, -5) → abs (10, 0).
    const out = wrapWithRotation(inner, { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 2 });
    const t = (out[0] as Extract<DrawCommand, { kind: 'group' }>).transform!;
    // Column-major Float32Array layout: m00,m10,_,m01,m11,_,tx,ty,_
    const [m00, m10, , m01, m11, , tx, ty] = Array.from(t);
    const x = m00 * 0 + m01 * 0 + tx;
    const y = m10 * 0 + m11 * 0 + ty;
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(0, 5);
  });
});
