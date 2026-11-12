/** An Alt-drag clone running a move's container behaviors through their `clone` parts. */
import { describe, it, expect } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import type { MoveBehavior } from '../../gestures/types';
import { snapToContainer } from '../move/behaviors/snapToContainer';
import { snapBackOrDelete } from '../move/behaviors/snapBackOrDelete';
import { cloneAction } from './action';

const MODS = { alt: true, ctrl: false, meta: false, shift: false };
const BIN = { x: 100, y: 0, width: 50, height: 50 };
const SLOT = { x: 110, y: 10, width: 10, height: 10 };

function fixture() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const bin = scene.add({ kind: 'group', layer: 'main', data: {}, pose: BIN });
  const token = scene.add({ kind: 'mark', layer: 'main', data: { color: 'green' }, pose: { x: 0, y: 0, width: 10, height: 10 } });
  let selected: NodeId[] = [token];
  const selection = { get: () => selected, set: (ids: NodeId[]) => { selected = ids; } };
  const base = { world: { x: 5, y: 5 }, modifiers: MODS, deps: { selection, scene } };
  const at = (x: number, y: number): InvocationCtx => ({
    ...base,
    world: { x, y },
    drag: { start: { x: 5, y: 5 }, current: { x, y }, delta: { x: x - 5, y: y - 5 } },
  }) as unknown as InvocationCtx;
  const moveBehaviors: MoveBehavior<RectPose>[] = [
    snapToContainer<RectPose>({
      dwellMs: 0,
      isInstant: () => true,
      findTarget: (_id, wx, wy) =>
        wx >= BIN.x && wx <= BIN.x + BIN.width && wy >= BIN.y && wy <= BIN.y + BIN.height
          ? { parentId: bin, slotPose: SLOT }
          : null,
    }),
    snapBackOrDelete<RectPose>({ radius: 30, onFreeRelease: 'snap-back' }),
  ];
  const opts = { behaviors: moveBehaviors.flatMap((b) => (b.clone ? [b.clone] : [])) } as BindingOpts;
  const start = () => (cloneAction.invoker as OngoingInvoker).start(at(5, 5), opts) as OngoingHandle;
  const copies = () => [...scene.nodesOnLayer('main')].filter((n) => n.id !== token && n.id !== bin);
  return { scene, bin, token, start, at, copies, selected: () => selected };
}

describe('cloneAction with container behaviors', () => {
  it('drops the copy into the container at its slot and leaves the original', () => {
    const f = fixture();
    const handle = f.start();
    handle.onMove!(f.at(125, 25));
    expect(handle.previewPose!(f.token)).toMatchObject({ x: SLOT.x, y: SLOT.y });
    handle.onEnd!(f.at(125, 25), 'commit');
    const [copy] = f.copies();
    expect(f.copies()).toHaveLength(1);
    expect(copy.parent).toBe(f.bin);
    expect(copy.data).toEqual({ color: 'green' });
    expect(f.scene.get(f.token)).toMatchObject({ parent: null, pose: { x: 0, y: 0 } });
    expect(f.selected()).toEqual([copy.id]);
  });

  it('makes no copy when released off every container', () => {
    const f = fixture();
    const handle = f.start();
    handle.onMove!(f.at(70, 80));
    handle.onEnd!(f.at(70, 80), 'commit');
    expect(f.copies()).toEqual([]);
    expect(f.selected()).toEqual([f.token]);
  });
});
