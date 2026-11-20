import { describe, expect, it } from 'vitest';
import { addOutsideSource, outsideGeneration } from './outsideReads';

describe('outsideGeneration', () => {
  it('never comes back to a value it gave once a source is removed', () => {
    let a = 3;
    const b = 5;
    const offA = addOutsideSource(() => a);
    const offB = addOutsideSource(() => b);
    const recorded = outsideGeneration();
    offB();
    expect(outsideGeneration()).toBeGreaterThan(recorded);
    a += 5;
    expect(outsideGeneration()).toBeGreaterThan(recorded);
    offB();
    offA();
    expect(outsideGeneration()).toBeGreaterThan(recorded);
  });
});
