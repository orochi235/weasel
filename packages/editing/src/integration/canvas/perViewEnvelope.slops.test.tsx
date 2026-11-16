/** The slops overlay halos the selection chrome of the view it is drawn for, at that view's bounds. */
import { describe, it, expect } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import type { ChromeState, View } from '@weasel-js/core';
import { asNodeId } from '@weasel-js/core/engine';
import { chromeAffordancesForTests as chromeAffordances, createSlopsDebugLayerForTests as createSlopsDebugLayer } from '@weasel-js/core/test-seams';
import { SELECTION_CHROME } from '../../chrome/selectionChrome';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600, dpr: 1 };

const envelope = (chromeState: ChromeState) => ({
  getPreviewSources: () => [], getGestureOverlays: () => [], getChromeState: () => chromeState, getIsVisible: () => () => true,
});

function minX(cmds: DrawCommand[]): number {
  let min = Infinity;
  for (const c of cmds) {
    if (c.kind !== 'path') continue;
    if (c.path.kind === 'rect') { min = Math.min(min, c.path.x); continue; }
    if (c.path.kind !== 'polygon') continue;
    const { coords } = c.path;
    for (let i = 0; i < coords.length; i += 2) min = Math.min(min, coords[i]!);
  }
  return min;
}

describe('slops-debug overlay answers for the view it is drawn for', () => {
  it('halos each view\'s own selection at that view\'s bounds', () => {
    const layer = createSlopsDebugLayer({ getAffordances: () => chromeAffordances({ selectionChrome: SELECTION_CHROME }) });

    const chrome = (x: number, ids: string[]): ChromeState => ({
      selection: ids.map(asNodeId),
      multiActive: false,
      boundsOf: () => ({ x, y: 0, width: 10, height: 10 }),
      unionBounds: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    });

    const a = layer.draw(envelope(chrome(0, ['n1'])), VIEW, DIMS);
    const b = layer.draw(envelope(chrome(500, ['n1'])), VIEW, DIMS);
    expect(a.length).toBeGreaterThan(0);
    expect(minX(a)).not.toEqual(minX(b));
    expect(layer.draw(envelope(chrome(0, [])), VIEW, DIMS)).toEqual([]);
  });
});
