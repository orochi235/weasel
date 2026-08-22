import { describe, it, expect } from 'vitest';
import { GroupState, IDENTITY_COLOR_MATRIX } from './GroupState';
import { mat3 } from '../math/mat3';

describe('GroupState', () => {
  it('starts at identity transform and alpha=1', () => {
    const s = new GroupState();
    expect(Array.from(s.transform)).toEqual(Array.from(mat3.identity()));
    expect(s.alpha).toBe(1);
  });

  it('push() composes transform and multiplies alpha', () => {
    const s = new GroupState();
    s.push({ transform: mat3.translate(mat3.identity(), 10, 20), alpha: 0.5 });
    const [x, y] = mat3.apply(s.transform, 0, 0);
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(s.alpha).toBe(0.5);
  });

  it('nested push composes both levels', () => {
    const s = new GroupState();
    s.push({ transform: mat3.translate(mat3.identity(), 10, 0), alpha: 0.5 });
    s.push({ transform: mat3.translate(mat3.identity(), 0, 20), alpha: 0.5 });
    const [x, y] = mat3.apply(s.transform, 0, 0);
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(s.alpha).toBe(0.25);
  });

  it('pop() restores previous transform and alpha', () => {
    const s = new GroupState();
    const before = Array.from(s.transform);
    s.push({ transform: mat3.translate(mat3.identity(), 10, 20), alpha: 0.5 });
    s.pop();
    expect(Array.from(s.transform)).toEqual(before);
    expect(s.alpha).toBe(1);
  });

  it('omitting transform/alpha in push() leaves them unchanged', () => {
    const s = new GroupState();
    s.push({ alpha: 0.5 });
    expect(Array.from(s.transform)).toEqual(Array.from(mat3.identity()));
    expect(s.alpha).toBe(0.5);
    s.pop();
    s.push({ transform: mat3.translate(mat3.identity(), 5, 5) });
    expect(s.alpha).toBe(1);
  });

  it('pop() at the root throws (helps catch unbalanced renderer code)', () => {
    const s = new GroupState();
    expect(() => s.pop()).toThrow();
  });
});

describe('GroupState — colorMatrix', () => {
  it('starts at identity colorMatrix', () => {
    const s = new GroupState();
    expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
  });

  it('push with no colorMatrix leaves colorMatrix unchanged', () => {
    const s = new GroupState();
    s.push({ alpha: 0.5 });
    expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
  });

  it('push with identity colorMatrix produces identity', () => {
    const s = new GroupState();
    s.push({ colorMatrix: IDENTITY_COLOR_MATRIX });
    expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
  });

  it('pop() after colorMatrix push restores identity', () => {
    const s = new GroupState();
    const negR = new Float32Array([-1,0,0,0,1, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]);
    s.push({ colorMatrix: negR });
    s.pop();
    expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
  });

  it('compose4x5: outer bias is added', () => {
    const addR = new Float32Array([1,0,0,0,0.1, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]);
    const s = new GroupState();
    s.push({ colorMatrix: addR });
    s.push({ colorMatrix: addR });
    expect(s.colorMatrix[4]).toBeCloseTo(0.2, 5);
  });

  it('reset() drops every pushed frame', () => {
    const s = new GroupState();
    s.push({ transform: mat3.translate(mat3.identity(), 10, 20), alpha: 0.5 });
    s.push({ alpha: 0.5, colorMatrix: new Float32Array([-1,0,0,0,1, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]) });
    s.reset();
    expect(Array.from(s.transform)).toEqual(Array.from(mat3.identity()));
    expect(s.alpha).toBe(1);
    expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
    expect(() => s.pop()).toThrow();
  });

  it('compose4x5: nested matrices compose in correct order (inner first)', () => {
    // Swap R and G
    const swapRG = new Float32Array([0,1,0,0,0, 1,0,0,0,0, 0,0,1,0,0, 0,0,0,1,0]);
    // Swap G and B
    const swapGB = new Float32Array([1,0,0,0,0, 0,0,1,0,0, 0,1,0,0,0, 0,0,0,1,0]);
    const s = new GroupState();
    s.push({ colorMatrix: swapRG }); // outer
    s.push({ colorMatrix: swapGB }); // inner — applied first
    // Input (R,G,B) → swapGB → (R,B,G) → swapRG → (B,R,G)
    expect(s.colorMatrix[0]).toBeCloseTo(0, 5);
    expect(s.colorMatrix[1]).toBeCloseTo(0, 5);
    expect(s.colorMatrix[2]).toBeCloseTo(1, 5);
  });
});
