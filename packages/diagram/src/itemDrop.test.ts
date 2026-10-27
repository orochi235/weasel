import { describe, expect, it, vi } from 'vitest';
import { createScene, overlaysOf, type InvocationCtx, type OngoingHandle, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DiagramData, type DiagramSceneData } from './fromData';
import { createItemDropAction, DIAGRAM_ITEM_CARRY, type ItemDrop } from './itemDrop';
import { sceneParticipants } from './portLayer';

const node = (id: string, x: number, y: number) => ({ id, lines: [id], width: 60, height: 40, at: { x, y }, pinned: true });

/** `row` reorders its three members along x; `bag` holds `b1` and does not reorder; `free` stands outside both. */
const DATA: DiagramData = {
  nodes: [node('r1', 60, 140), node('r2', 160, 140), node('r3', 260, 140), node('b1', 460, 140), node('free', 60, 400)],
  edges: [],
  containers: [
    { id: 'row', role: 'container', label: 'Row', members: ['r1', 'r2', 'r3'], reorder: 'x', box: { x: 40, y: 100, width: 320, height: 100 }, pinned: true },
    { id: 'bag', role: 'container', label: 'Bag', members: ['b1'], box: { x: 440, y: 100, width: 200, height: 160 }, pinned: true },
  ],
};

function setup(opts: Partial<Parameters<typeof createItemDropAction>[0]> = {}) {
  const scene = createScene<DiagramSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
  for (const spec of diagramScene(DATA, { layout: 'none' })) scene.add(spec as never);
  const report = vi.fn<(drop: ItemDrop) => void>();
  const action = createItemDropAction({ participants: sceneParticipants<RectPose>(scene as never), report, ...opts });
  const ctxAt = (x: number, y: number) => ({
    world: { x, y }, screen: { x, y }, modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    deps: { scene }, carry: { type: DIAGRAM_ITEM_CARRY, value: { kind: 'blur' } },
  }) as unknown as InvocationCtx;
  const invoker = action.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const carry = (x: number, y: number): OngoingHandle => invoker.start(ctxAt(x, y));
  return { report, carry, ctxAt };
}

describe('the item drop', () => {
  it('reports a drop between two members of a reorderable container at their gap', () => {
    const { report, carry, ctxAt } = setup();
    const handle = carry(0, 0);
    handle.onMove!(ctxAt(240, 160));
    const bar = overlaysOf(handle).find((o) => o.kind === 'polyline' && o.role === 'insert');
    expect(bar).toBeDefined();
    handle.onEnd!(ctxAt(240, 160), 'commit');
    expect(report).toHaveBeenCalledWith({ item: { kind: 'blur' }, target: 'row', container: 'row', index: 2, at: { x: 240, y: 160 } });
  });

  it('reports a drop on a member as that node, in its container, at the place the pointer is', () => {
    const { report, carry, ctxAt } = setup();
    const handle = carry(170, 160);
    handle.onEnd!(ctxAt(170, 160), 'commit');
    expect(report).toHaveBeenCalledWith({ item: { kind: 'blur' }, target: 'r2', container: 'row', index: 1, at: { x: 170, y: 160 } });
  });

  it('places a drop in a container that does not reorder by where it is, and one on bare canvas at none', () => {
    const { report, carry, ctxAt } = setup();
    carry(0, 0).onEnd!(ctxAt(600, 230), 'commit');
    carry(0, 0).onEnd!(ctxAt(800, 600), 'commit');
    expect(report.mock.calls.map(([d]) => [d.target, d.container, d.index])).toEqual([['bag', 'bag', 1], [null, null, null]]);
  });

  it('draws a target the host refuses as refused with its reason, and reports nothing on release there', () => {
    const canDrop = vi.fn((_item: unknown, t: { container: string | null }) => (t.container === 'bag' ? { refuse: 'Bag is sealed' } : true));
    const { report, carry, ctxAt } = setup({ canDrop });
    const handle = carry(0, 0);
    handle.onMove!(ctxAt(600, 230));
    const overlays = overlaysOf(handle);
    expect(overlays).toContainEqual({ kind: 'reason', at: { x: 600, y: 230 }, text: 'Bag is sealed' });
    expect(overlays.some((o) => o.kind === 'polyline' && o.role === 'refused')).toBe(true);
    handle.onEnd!(ctxAt(600, 230), 'commit');
    expect(report).not.toHaveBeenCalled();
    expect(canDrop).toHaveBeenCalledWith({ kind: 'blur' }, expect.objectContaining({ target: 'bag', container: 'bag', index: 1 }));
  });

  it('reports nothing for a carry that leaves the canvas', () => {
    const { report, carry, ctxAt } = setup();
    carry(0, 0).onEnd!(ctxAt(240, 160), 'cancel');
    expect(report).not.toHaveBeenCalled();
  });
});
