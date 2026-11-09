import { describe, expect, it } from 'vitest';
import { canSpin, clampToBounds, snapToStep, spinKey } from './spin';

describe('snapToStep', () => {
  it('lands on the step grid without float dust', () => {
    expect(snapToStep(0.3, 0.1)).toBe(0.3);
    expect(snapToStep(0.29, 0.1)).toBe(0.3);
    expect(snapToStep(1.15, 0.05, 0.1)).toBe(1.15);
  });

  it('counts steps from the origin', () => {
    expect(snapToStep(7, 5, 1)).toBe(6);
    expect(snapToStep(0.44, 0.25, 0.1)).toBe(0.35);
  });

  it('keeps every place a step written in e-notation carries', () => {
    expect(snapToStep(4.6e-7, 1.5e-7)).toBe(4.5e-7);
  });

  it('rounds a decimal half up a step, as it reads, where binary division lands just short of it', () => {
    expect(0.35 / 0.1).toBeLessThan(3.5);
    expect(snapToStep(0.35, 0.1)).toBe(0.4);
    expect(snapToStep(0.15, 0.1)).toBe(0.2);
    expect(snapToStep(1.25, 0.1)).toBe(1.3);
    expect(snapToStep(0.075, 0.05)).toBe(0.1);
    expect(snapToStep(2.5, 1)).toBe(3);
    expect(snapToStep(0.45, 0.1, 0.05)).toBe(0.45);
    expect(snapToStep(0.5, 0.1, 0.05)).toBe(0.55);
  });

  it('rounds a half away from the origin on either side, so a move and its reverse snap alike', () => {
    expect(snapToStep(-0.35, 0.1)).toBe(-0.4);
    expect(snapToStep(-2.5, 1)).toBe(-3);
    expect(snapToStep(-0.05, 0.1)).toBe(-0.1);
  });

  it('snaps a value carrying more places than it can scale exactly', () => {
    expect(snapToStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(snapToStep(1 / 3, 0.25)).toBe(0.25);
  });

  it('leaves a value alone when there is no step', () => {
    expect(snapToStep(0.123, 0)).toBe(0.123);
  });
});

describe('an endless end', () => {
  const bounds = { step: 1, min: 0, max: 10, endless: 'max' as const };

  it('keeps the infinity it stands for, and clamps the other', () => {
    expect(clampToBounds(Infinity, bounds)).toBe(Infinity);
    expect(clampToBounds(-Infinity, bounds)).toBe(0);
    expect(clampToBounds(40, bounds)).toBe(10);
  });

  it('is one step past its bound, so stepping reaches infinity and comes back', () => {
    expect(spinKey('ArrowUp', 10, bounds)).toBe(Infinity);
    expect(spinKey('ArrowUp', 9, bounds)).toBe(10);
    expect(spinKey('ArrowDown', Infinity, bounds)).toBe(10);
    expect(spinKey('End', 3, bounds)).toBe(Infinity);
    expect(spinKey('Home', 3, bounds)).toBe(0);
    expect(spinKey('ArrowUp', 10, { ...bounds, endless: undefined })).toBe(10);
  });

  it('lands a coarse step on the bound before it reaches infinity, as a slider thumb does', () => {
    expect(spinKey('PageUp', 5, bounds)).toBe(10);
    expect(spinKey('PageUp', 10, bounds)).toBe(Infinity);
    const both = { ...bounds, endless: 'both' as const };
    expect(spinKey('PageDown', 5, both)).toBe(0);
    expect(spinKey('PageDown', 0, both)).toBe(-Infinity);
  });
});

describe('canSpin', () => {
  it('is false at the bound a key heads for, and for a key that does not spin', () => {
    const b = { step: 1, min: 0, max: 3 };
    expect(canSpin('ArrowUp', 2, b)).toBe(true);
    expect(canSpin('ArrowUp', 3, b)).toBe(false);
    expect(canSpin('ArrowDown', 3, b)).toBe(true);
    expect(canSpin('ArrowDown', 0, b)).toBe(false);
    expect(canSpin('a', 1, b)).toBe(false);
  });

  it('steps past an endless bound to infinity, and no further', () => {
    const b = { step: 1, min: 0, max: 3, endless: 'max' as const };
    expect(canSpin('ArrowUp', 3, b)).toBe(true);
    expect(canSpin('ArrowUp', Infinity, b)).toBe(false);
  });
});
