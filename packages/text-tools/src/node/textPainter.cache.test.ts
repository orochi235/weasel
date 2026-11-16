/** `kit:text`'s paint memo and its silhouette cache, and when they let go. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundsOfPath } from '@weasel-js/geom';
import { registerBidi } from '@weasel-js/text';
import { bidi } from '@weasel-js/bidi';
import { registerFontOutlines, loadFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { findNodeShape, findShapeSilhouette, type SceneNode as Node } from '@weasel-js/core';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { withTextPainter } from '../testing/textPainter';

interface RectPose { x: number; y: number; width: number; height: number }

afterEach(() => {
  _resetShapePaintersForTests();
});
withTextPainter();

/** A node whose `pose` / `data` can be swapped the way the scene ops do:
 *  same object, new field references. */
function makeNode(data: unknown, pose: RectPose): Node<unknown, string, RectPose> {
  return { id: 'n', kind: 'mark', layer: 'main', pose, data } as unknown as Node<unknown, string, RectPose>;
}

const POSE: RectPose = { x: 0, y: 0, width: 100, height: 60 };

describe('kit:text paint caching', () => {
  it('memoizes kit:text, so its runs array stays stable frame to frame', () => {
    // Not for `paint`'s own cost — `resolveTextStyle` + `resolveRuns` are
    // pure style merging and measure 0.14 ms/frame at 1000 text nodes.
    // It is the enabler for the renderer's layout cache, which keys on the
    // `ResolvedRun[]` identity the way the mesh cache keys on `Path`
    // identity. `layoutRuns` is 25.9 ms/frame for 200 wrapped paragraphs, and
    // a fresh runs array per frame would leave that cache missing on every
    // draw. Same shape of win as `kit:shape`: memoizing a cheap thing to turn
    // an expensive cache on.
    const node = makeNode({ text: 'Hi' }, POSE);
    const painter = findNodeShape(node);
    expect(painter?.id).toBe('kit:text');
    const a = painter!.paint(node, node.pose)[0] as { runs: unknown };
    const b = painter!.paint(node, node.pose)[0] as { runs: unknown };
    expect(b).toBe(a);
    expect(b.runs).toBe(a.runs);
  });

  it('rebuilds kit:text when the text changes', () => {
    const node = makeNode({ text: 'Hi' }, POSE);
    const before = findNodeShape(node)!.paint(node, node.pose)[0] as { runs: { text: string }[] };
    expect(before.runs[0].text).toBe('Hi');
    (node as { data: unknown }).data = { text: 'Bye' };
    const after = findNodeShape(node)!.paint(node, node.pose)[0] as { runs: { text: string }[] };
    expect(after.runs[0].text).toBe('Bye');
  });
});

describe('kit:text silhouette and the layout engines', () => {
  const BARS: OutlineFace = {
    unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0,
    glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
  };
  afterEach(() => { registerBidi(null); _resetFontOutlinesForTests(); });

  it('rebuilds when a bidi engine is registered after it was measured', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
    await loadFontOutlines('bars');
    const node = makeNode(
      { text: 'אבג', style: { fontFamily: 'bars', fontSize: 20, align: 'start' } },
      { x: 0, y: 0, width: 400, height: 60 },
    );
    const left = (): number => boundsOfPath(findShapeSilhouette(node, node.pose)!).x;
    const before = left();
    registerBidi(bidi);
    expect(left()).toBeGreaterThan(before + 100);
  });
});
