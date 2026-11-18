import { describe, expect, it } from 'vitest';
import { circlePath } from '@weasel-js/core';
import { drawDot, splitShare } from '../GeomDemo';

describe('GeomDemo dots', () => {
  it('draw at the pose a move wrote, not where the dot was created', () => {
    const [cmd] = drawDot('control', { x: 300, y: 200 });
    expect(cmd).toMatchObject({ kind: 'path', path: circlePath(307, 207, 6) });
  });
});

describe('GeomDemo split share', () => {
  it('reads 0% for a curve whose points coincide, not NaN', () => {
    expect(splitShare({ length: 0, beforeLength: 0 })).toBe(0);
    expect(splitShare({ length: 200, beforeLength: 50 })).toBe(25);
  });
});
