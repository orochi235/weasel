import { beforeEach, describe, expect, it } from 'vitest';
import { hasEditablePath } from '@weasel-js/core';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { withTextPainter } from '../testing/textPainter';

beforeEach(() => _resetShapePaintersForTests());
withTextPainter();

describe('a text node under path edit', () => {
  it('has no editable path, since kit:text and not its rect pose draws it', () => {
    const node = { kind: 'mark', pose: { x: 100, y: 50, width: 20, height: 10 }, data: { text: 'hi' } };
    expect(hasEditablePath(node as never)).toBe(false);
  });
});
