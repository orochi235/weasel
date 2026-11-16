import { afterEach, describe, expect, it } from 'vitest';
import { registerShaper, registeredShaper } from './shaperRegistry';
import { registerBidi, registeredBidi } from './bidiRegistry';
import type { TextShaper } from './shaperSeam';
import type { BidiEngine } from './bidiSeam';

const shaperA = {} as TextShaper;
const shaperB = {} as TextShaper;
const bidiA = {} as BidiEngine;
const bidiB = {} as BidiEngine;

afterEach(() => {
  registerShaper(null);
  registerBidi(null);
});

describe('registering a layout engine over another', () => {
  it('throws for a different shaper, and takes its place with replace', () => {
    registerShaper(shaperA);
    registerShaper(shaperA);
    expect(() => registerShaper(shaperB)).toThrow(/registerShaper: a different shaper is already registered/);
    expect(registeredShaper()).toBe(shaperA);
    registerShaper(shaperB, { replace: true });
    expect(registeredShaper()).toBe(shaperB);
  });

  it('throws for a different bidi engine, and takes its place with replace', () => {
    registerBidi(bidiA);
    expect(() => registerBidi(bidiB)).toThrow(/registerBidi: a different bidi engine/);
    registerBidi(bidiB, { replace: true });
    expect(registeredBidi()).toBe(bidiB);
  });

  it('takes a new engine quietly once the old one is released', () => {
    const off = registerShaper(shaperA);
    off();
    registerShaper(shaperB);
    expect(registeredShaper()).toBe(shaperB);
  });
});
