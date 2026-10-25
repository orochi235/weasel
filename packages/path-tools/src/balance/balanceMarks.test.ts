import { describe, expect, it } from 'vitest';
import { pathFromD, pathToAnchors, type AnchorSet, type PolygonPath, type View } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createPathEditingOverlayLayer } from '@weasel-js/core';
import { createBalanceExtension } from './balanceMarks';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
// One curved segment, with both handles off their anchors, and one straight.
const PATH = pathFromD('M0 0 C20 20 60 40 100 0 L200 0') as PolygonPath;
const extension = createBalanceExtension();

function draw(shown: readonly string[]) {
  const layer = createPathEditingOverlayLayer({
    getEditingId: () => 'p',
    getPose: () => PATH,
    getNode: () => ({ pose: PATH, data: {} }),
    getExtensions: () => [extension],
  });
  const envelope = { getIsVisible: () => (id: string) => id === 'path-edit.anchors' || shown.includes(id) };
  return layer.draw(envelope as never, VIEW, { width: 400, height: 400, dpr: 1 }) as DrawCommand[];
}

describe('path-edit overlay balance lines', () => {
  it('draws the curved segment\'s balance line and grip only while chrome-caps shows them', () => {
    const plain = draw([]).length;
    const shown = draw(['path-edit.balance']);
    expect(shown.length).toBe(plain + 2);
    const line = shown[0];
    if (line.kind !== 'path' || line.path.kind !== 'polygon') throw new Error('expected a line path');
    expect([...line.path.coords.slice(0, 4)]).toEqual([20, 20, 60, 40]);
  });

  it('lays a grip midway along the line, pressed as balance:N under its own chrome id', () => {
    const anchors = pathToAnchors(PATH) as AnchorSet;
    const parts = extension.parts!({ id: 'p', node: { pose: PATH, data: {} }, path: PATH, anchors });
    expect(parts).toEqual([{ x: 40, y: 30, hitKind: 'balance:0', chromeId: 'path-edit.balance' }]);
  });
});
