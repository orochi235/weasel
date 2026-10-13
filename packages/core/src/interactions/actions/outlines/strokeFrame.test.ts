/**
 * The frame a stroke is outlined in: the node's own for a world width, the
 * screen for a `{ px }` one. Booleans and Outline Stroke both go through it.
 */
import { describe, it, expect, vi } from 'vitest';
import { boundsOfPath, pathFromD, type Mat3, type Path } from '@weasel-js/geom';
import type { ImmediateInvoker } from '@weasel-js/routing';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import { asNodeId, type NodeId } from 'core/scene/types';
import { applyBooleanOp, type BooleansAdapter } from '../booleans/booleans';
import { outlineStrokeAction } from './outlineStrokeAction';
import { stubDeps } from '../testUtils';
import type { CreateOutlinesAdapter } from './createOutlines';
import { applyOutlineStroke } from './outlineStroke';

const RED = { color: '#f00' };
const ACROSS = pathFromD('M0 50 L100 50');
const DOWN = pathFromD('M50 0 L50 100');
/** A frame that draws everything four times as wide. */
const WIDE: Mat3 = [4, 0, 0, 1, 0, 0];

function outlines(path: Path, paint: PathPaint, frame?: Mat3) {
  const made: Path[] = [];
  const adapter: CreateOutlinesAdapter = {
    getSelection: () => [asNodeId('line')],
    getTextSource: () => undefined,
    getWorldPath: () => path,
    getPaint: () => paint,
    ...(frame ? { getStrokeFrame: () => frame } : {}),
    createPathNode: (p) => { made.push(p); return { id: `p${made.length}` }; },
    applyOps: vi.fn(),
  };
  return { adapter, size: () => boundsOfPath(made[0]!) };
}

describe('applyOutlineStroke: the frame the stroke is drawn in', () => {
  it('stretches a world-width stroke with the frame its node draws it in', () => {
    const h = outlines(DOWN, { fill: null, stroke: { paint: RED, width: 10 } }, WIDE);
    applyOutlineStroke(h.adapter);
    expect(h.size().width).toBeCloseTo(40);
  });

  it('measures a { px } width on each axis of a view that scales them apart', () => {
    const px: PathPaint = { fill: null, stroke: { paint: RED, width: { px: 8 } } };
    const across = outlines(ACROSS, px);
    applyOutlineStroke(across.adapter, { scale: { x: 4, y: 1 } });
    expect(across.size().height).toBeCloseTo(8);
    const down = outlines(DOWN, px);
    applyOutlineStroke(down.adapter, { scale: { x: 4, y: 1 } });
    expect(down.size().width).toBeCloseTo(2);
  });

  it('leaves a { px } width out of the node\'s frame: it is drawn on screen', () => {
    const h = outlines(DOWN, { fill: null, stroke: { paint: RED, width: { px: 8 } } }, WIDE);
    applyOutlineStroke(h.adapter, { scale: 2 });
    expect(h.size().width).toBeCloseTo(4);
  });

  it('the action hands over the view\'s scale per axis', () => {
    const h = outlines(ACROSS, { fill: null, stroke: { paint: RED, width: { px: 8 } } });
    const view = { get: () => ({ x: 0, y: 0, scale: { x: 4, y: 1 } }) };
    (outlineStrokeAction.invoker as ImmediateInvoker).run(
      stubDeps({ selection: { get: () => [asNodeId('line')] }, createOutlinesAdapter: h.adapter, view }), {},
    );
    expect(h.size().height).toBeCloseTo(8);
  });
});

describe('applyBooleanOp: the frame a counted stroke is drawn in', () => {
  const BOX: Path = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };

  function harness(linePath: Path, stroke: NonNullable<PathPaint['stroke']>, frame?: Mat3) {
    const made: Path[] = [];
    const paths: Record<string, Path> = { box: BOX, line: linePath };
    const adapter: BooleansAdapter = {
      getSelection: () => ['box', 'line'] as NodeId[],
      getWorldPath: (id) => paths[id],
      getPaint: (id) => (id === 'line' ? { fill: null, stroke } : { fill: { paint: RED } }),
      ...(frame ? { getStrokeFrame: (id: NodeId) => (id === 'line' ? frame : null) } : {}),
      compareZ: (a, b) => (a === 'box' ? -1 : 1) - (b === 'box' ? -1 : 1),
      createPathNode: (p) => { made.push(p); return { id: `r${made.length}` }; },
      applyOps: () => {},
    };
    return { adapter, size: () => boundsOfPath(made[0]!) };
  }

  it('stretches a world-width stroke with the frame its node draws it in', () => {
    const h = harness(DOWN, { paint: RED, width: 10 }, WIDE);
    applyBooleanOp(h.adapter, 'intersect', { strokes: 'unfilled' });
    expect(h.size().width).toBeCloseTo(40);
  });

  it('measures a { px } width on each axis of a view that scales them apart', () => {
    const h = harness(ACROSS, { paint: RED, width: { px: 8 } });
    applyBooleanOp(h.adapter, 'intersect', { strokes: 'unfilled', scale: { x: 4, y: 1 } });
    expect(h.size().height).toBeCloseTo(8);
  });
});
