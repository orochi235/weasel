/**
 * An insert's live preview under a scene's quantize rule: the `insert` dep's
 * `peek` answers the node a release would make without counting it, and the
 * preview lands where the release commits.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { InvocationCtx, OngoingOverlay } from '@weasel-js/routing';
import { snapToPitch, type OutputGrid } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { sceneMutators } from 'core/scene/sceneMutators';
import { OUTPUT_GRID_KEY, quantizeSize } from 'core/scene/outputGrid';
import type { RectPose, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { insertAction } from 'interactions/actions/insert/action';
import type { InsertDep } from 'interactions/actions/depSchema';
import { insertPreviewExtent } from '../insertPreviewExtent';
import { useInsertDepSource } from './insert';
import { cycleFill, solid } from '../../util/paint';

const GRID: OutputGrid = { pitch: 0.4, origin: { x: 0, y: 0 } };
type S = Scene<unknown, 'main', RectPose>;

function makeScene(): S {
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    doc: { [OUTPUT_GRID_KEY]: GRID },
    quantize: {
      stored: ({ pose }, grid, anchor) => ({
        pose: quantizeSize(pose, snapToPitch(pose.width, grid.pitch), snapToPitch(pose.height, grid.pitch), anchor),
      }),
    },
  });
}

function insertDepOf(scene: S): InsertDep {
  const any = scene as unknown as Scene<unknown, string, unknown>;
  const adapter = { applyOps: (ops: Op[], label?: string) => scene.applyBatch(ops, label ?? 'Insert', sceneMutators(any)) };
  let reg!: DepRegistry;
  function Wire() {
    useInsertDepSource(any, adapter);
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  return reg.get('insert')!;
}

/** Drag out a rect, reading the preview after each move. */
function drag(scene: S, dep: InsertDep, from: { x: number; y: number }, moves: { x: number; y: number }[]) {
  const ctx = (world: { x: number; y: number }): InvocationCtx => ({
    world, screen: world, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { insert: dep, scene: scene as never },
  });
  const invoker = insertAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = invoker.start(ctx(from), { params: { kind: 'rect' } });
  const previews: OngoingOverlay[] = [];
  for (const at of moves) {
    handle.onMove!({ ...ctx(at), drag: { start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y } } } as InvocationCtx);
    const ov = handle.overlay?.();
    if (ov && !Array.isArray(ov)) previews.push(ov as OngoingOverlay);
  }
  handle.onEnd!(ctx(moves.at(-1)!), 'commit');
  return previews;
}

const onlyNode = (scene: S, n: number) => [...scene.nodes.values()][n]!;

describe('an insert preview under a quantize rule', () => {
  it('lands where the release commits the node', () => {
    const scene = makeScene();
    const previews = drag(scene, insertDepOf(scene), { x: 10.13, y: 20.07 }, [{ x: 30.3, y: 31.1 }, { x: 41.27, y: 52.91 }]);
    const last = previews.at(-1) as Extract<OngoingOverlay, { kind: 'insertPreview' }>;
    expect(last.kind).toBe('insertPreview');
    expect(last.lands).toBeDefined();
    const shown = insertPreviewExtent(last).bounds;
    const committed = onlyNode(scene, 0).pose;
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(shown[k]).toBeCloseTo(committed[k], 9);
    expect(Math.abs(committed.width / GRID.pitch - Math.round(committed.width / GRID.pitch))).toBeLessThan(1e-9);
  });

  it('does not advance the palette while it is dragged', () => {
    const scene = makeScene();
    const dep = insertDepOf(scene);
    const many = Array.from({ length: 6 }, (_, i) => ({ x: 20 + i * 3.1, y: 30 + i * 2.7 }));
    drag(scene, dep, { x: 0, y: 0 }, many);
    drag(scene, dep, { x: 100, y: 0 }, many.map((p) => ({ x: p.x + 100, y: p.y })));
    const fills = [0, 1].map((n) => (onlyNode(scene, n).data as { fill?: unknown }).fill);
    expect(fills).toEqual([{ paint: solid(cycleFill(1)) }, { paint: solid(cycleFill(2)) }]);
  });

  it('answers the node a release would make, minting nothing', () => {
    const scene = makeScene();
    const dep = insertDepOf(scene);
    const bounds = { x: 1, y: 2, width: 3.3, height: 4.1 };
    const peeked = dep.peek!(bounds, { kind: 'rect' });
    expect(peeked?.pose).toEqual(bounds);
    expect(scene.nodes.size).toBe(0);
    expect(dep.peek!(bounds, { kind: 'rect' })).toEqual(peeked);
  });
});
