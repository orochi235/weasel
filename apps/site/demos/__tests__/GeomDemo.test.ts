import { describe, expect, it } from 'vitest';
import { circlePath } from '@weasel-js/core';
import { drawDot } from '../GeomDemo';

describe('GeomDemo dots', () => {
  it('draw at the pose a move wrote, not where the dot was created', () => {
    const [cmd] = drawDot('control', { x: 300, y: 200 });
    expect(cmd).toMatchObject({ kind: 'path', path: circlePath(307, 207, 6) });
  });
});
