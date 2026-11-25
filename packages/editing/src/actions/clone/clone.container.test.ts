/** An Alt-drag clone running a move's container behaviors through their `clone` parts. */
import { describe, it, expect } from 'vitest';
import type { BindingOptions, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import type { NodeId, RectPose } from '@weasel-js/core';
import type { MoveBehavior } from '@weasel-js/core/engine';
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
  const base = { world: { x: 5, y: 5 }, modifiers: MODS, deps: { operands: selection, scene } };
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
  const opts = { behaviors: moveBehaviors.flatMap((b) => (b.clone ? [b.clone] : [])) } as BindingOptions;
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

describe('cloneAction dropping an envelope into a container', () => {
  it("stores the copy's children in the container's frame, at the slot", async () => {
    const { makeBooleanGroup } = await import('../pathfinder/booleanGroupAction');
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const bin = scene.add({ kind: 'group', layer: 'main', data: {}, pose: BIN });
    const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 4, height: 10 } });
    const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 6, y: 0, width: 4, height: 10 } });
    const env = makeBooleanGroup(scene as never, [a, b])!;
    let selected: NodeId[] = [env];
    const selection = { get: () => selected, set: (ids: NodeId[]) => { selected = ids; } };
    const at = (x: number, y: number): InvocationCtx => ({
      world: { x, y }, modifiers: MODS, deps: { operands: selection, scene },
      drag: { start: { x: 5, y: 5 }, current: { x, y }, delta: { x: x - 5, y: y - 5 } },
    }) as unknown as InvocationCtx;
    const opts = { behaviors: [snapToContainer<RectPose>({
      dwellMs: 0, isInstant: () => true,
      findTarget: (_id, wx) => (wx >= BIN.x && wx <= BIN.x + BIN.width ? { parentId: bin, slotPose: SLOT } : null),
    })].flatMap((x) => (x.clone ? [x.clone] : [])) } as BindingOptions;
    const handle = (cloneAction.invoker as OngoingInvoker).start(at(5, 5), opts) as OngoingHandle;
    handle.onMove!(at(125, 27));
    handle.onEnd!(at(125, 27), 'commit');
    const [copy] = selected;
    expect(copy).not.toBe(env);
    expect(scene.get(copy!)!.parent).toBe(bin);
    // The pair lands with its box on the slot: stored in the bin's frame, which sits at (100, 0).
    const [ca, cb] = scene.childrenOf(copy!);
    expect(scene.get(ca!)!.pose).toMatchObject({ x: SLOT.x - BIN.x, y: SLOT.y - BIN.y });
    expect(scene.get(cb!)!.pose).toMatchObject({ x: SLOT.x - BIN.x + 6, y: SLOT.y - BIN.y });
  });
});

describe('what a clone leaves Transform Again to repeat', () => {
  it('the offset a placement moved the copy, not the drag delta', async () => {
    const { lastTransform } = await import('@weasel-js/core');
    const f = fixture();
    const place = {
      onEnd: (_g: unknown, end: { copyOps: (p: unknown) => unknown }) =>
        end.copyOps({ parentId: f.bin, poses: new Map([[f.token, SLOT]]) }),
    };
    const handle = (cloneAction.invoker as OngoingInvoker).start(f.at(5, 5), { behaviors: [place] } as unknown as BindingOptions) as OngoingHandle;
    handle.onMove!(f.at(45, 5));
    handle.onEnd!(f.at(45, 5), 'commit');
    expect(f.copies()[0]!.parent).toBe(f.bin);
    expect(lastTransform(f.scene)).toEqual({ kind: 'duplicate', dx: SLOT.x, dy: SLOT.y });
  });

  it('nothing when a behavior claims the commit with no ops', async () => {
    const { lastTransform, recordTransform } = await import('@weasel-js/core');
    const f = fixture();
    recordTransform(f.scene, { kind: 'translate', dx: 1, dy: 1 }, [f.token]);
    const opts = { behaviors: [{ onEnd: () => [] }] } as unknown as BindingOptions;
    const handle = (cloneAction.invoker as OngoingInvoker).start(f.at(5, 5), opts) as OngoingHandle;
    handle.onMove!(f.at(45, 5));
    handle.onEnd!(f.at(45, 5), 'commit');
    expect(f.copies()).toEqual([]);
    expect(lastTransform(f.scene)).toBeUndefined();
  });
});
