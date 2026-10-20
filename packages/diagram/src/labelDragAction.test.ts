import { describe, expect, it } from 'vitest';
import {
  AUTO_POSE_DESCRIPTOR, createScene, documentDepOf, effectivePose,
  type ActionDeps, type InvocationCtx, type OngoingHandle, type Scene,
} from '@weasel-js/core';
import type { Path, Vec2 } from '@weasel-js/core/math';
import { EDGE_DERIVE_PATH } from './edge';
import { edgeLabelSpec, editEdgeLabelAction } from './edgeLabel';
import { diagramLabelOf, type DiagramLabel } from './labelTrait';
import { labelCenter, labelSpotAt } from './labels/station';
import { createLabelDragAction } from './labelDragAction';
import { LABEL_DRAG_AFFORDANCE_KIND, labelUnder, type LabelScratch } from './labelDragLayer';

interface Rect { x: number; y: number; width: number; height: number }
type Sc = Scene<unknown, 'main', Rect>;

const LABEL = 'ab/label';
const KEYS = { alt: false, shift: false, meta: false, ctrl: false };

/** Boxes a and b, and `ab` running straight from (100, 20) to (300, 20), labeled "Yes". */
function load(): Sc {
  const scene = createScene<unknown, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
  for (const [id, x] of [['a', 0], ['b', 300]] as const) {
    scene.add({ id: id as never, kind: 'leaf', layer: 'main', pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} } });
  }
  scene.add({
    id: 'ab' as never, kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { diagram: { from: { nodeId: 'a' }, to: { nodeId: 'b' }, router: 'straight' } },
    dependsOn: ['a' as never, 'b' as never], derivePath: EDGE_DERIVE_PATH as never,
  });
  scene.add(edgeLabelSpec('ab', 'Yes', { layer: 'main' }) as never);
  return scene;
}

const pathOf = (scene: Sc): Path => documentDepOf(scene as never, 'ab' as never)!.path!;
const boxOf = (scene: Sc, id: string) => AUTO_POSE_DESCRIPTOR.getBounds(effectivePose(scene as never, scene.get(id as never)! as never));
const centerOf = (b: Rect): Vec2 => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const labelOf = (scene: Sc) => diagramLabelOf(scene.get(LABEL as never)!)!;

function drag(scene: Sc, press: Vec2) {
  const deps = { scene } as unknown as ActionDeps;
  const ctxAt = (p: Vec2) => ({
    world: p, screen: p, modifiers: KEYS, deps,
    drag: {
      start: press, current: p, delta: { x: p.x - press.x, y: p.y - press.y },
      affordance: { kind: LABEL_DRAG_AFFORDANCE_KIND, payload: { targetId: LABEL, labelId: LABEL, edgeId: 'ab' } satisfies LabelScratch },
    },
  }) as unknown as InvocationCtx;
  const invoker = createLabelDragAction().invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = invoker.start(ctxAt(press), undefined) as OngoingHandle;
  return { handle, ctxAt };
}

describe('createLabelDragAction', () => {
  it('previews the label under the pointer and commits at, offset and dodge: false', () => {
    const scene = load();
    const size = boxOf(scene, LABEL);
    const press = centerOf(size);
    const to = { x: press.x, y: press.y + 40 };
    const { handle, ctxAt } = drag(scene, press);
    handle.onMove!(ctxAt(to));
    expect([...handle.previewIds!()!]).toEqual([LABEL]);
    const previewed = (handle.previewData!(LABEL) as { diagram: { label: DiagramLabel } }).diagram.label;
    const pose = handle.previewPose!(LABEL) as Rect;
    expect(centerOf(pose)).toEqual(labelCenter(pathOf(scene), previewed, size));
    handle.onEnd!(ctxAt(to), 'commit');
    expect(labelOf(scene)).toEqual({ ...labelSpotAt(pathOf(scene), to, size)!, dodge: false });
    expect(labelOf(scene)).not.toHaveProperty('placed');
  });

  it('is one history entry, undone in one', () => {
    const scene = load();
    const before = labelOf(scene);
    const depth = scene.historyEntries().length;
    const press = centerOf(boxOf(scene, LABEL));
    const { handle, ctxAt } = drag(scene, press);
    handle.onMove!(ctxAt({ x: press.x + 30, y: press.y + 40 }));
    handle.onEnd!(ctxAt({ x: press.x + 30, y: press.y + 40 }), 'commit');
    expect(scene.historyEntries().length).toBe(depth + 1);
    expect(scene.historyEntries().at(-1)?.label).toBe('Move label');
    scene.undo();
    expect(labelOf(scene)).toEqual(before);
  });

  it('commits nothing on a click with no movement', () => {
    const scene = load();
    const before = labelOf(scene);
    const depth = scene.historyEntries().length;
    const press = centerOf(boxOf(scene, LABEL));
    const { handle, ctxAt } = drag(scene, press);
    expect(handle.previewIds!()).toBeNull();
    handle.onEnd!(ctxAt(press), 'commit');
    expect(labelOf(scene)).toEqual(before);
    expect(scene.historyEntries().length).toBe(depth);
  });

  it('commits nothing when canceled', () => {
    const scene = load();
    const before = labelOf(scene);
    const press = centerOf(boxOf(scene, LABEL));
    const { handle, ctxAt } = drag(scene, press);
    handle.onMove!(ctxAt({ x: press.x, y: press.y + 40 }));
    handle.onEnd!(ctxAt({ x: press.x, y: press.y + 40 }), 'cancel');
    expect(labelOf(scene)).toEqual(before);
  });

  it('keeps its fraction when the edge is rerouted', () => {
    const scene = load();
    const size = boxOf(scene, LABEL);
    const press = centerOf(size);
    const { handle, ctxAt } = drag(scene, press);
    handle.onMove!(ctxAt({ x: press.x, y: press.y + 40 }));
    handle.onEnd!(ctxAt({ x: press.x, y: press.y + 40 }), 'commit');
    scene.setPose('b' as never, { x: 300, y: 120, width: 100, height: 40 });
    const label = labelOf(scene);
    expect(centerOf(boxOf(scene, LABEL))).toEqual(labelCenter(pathOf(scene), label, size));
    expect(label.at).toBeCloseTo(0.5);
  });
});

describe('labelUnder', () => {
  it('offers no region for a locked label or a label on a locked edge', () => {
    const scene = load();
    const at = centerOf(boxOf(scene, LABEL));
    scene.setLocked(LABEL as never, true);
    expect(labelUnder(scene as never, at)).toBeNull();
    scene.setLocked(LABEL as never, false);
    scene.setLocked('ab' as never, true);
    expect(labelUnder(scene as never, at)).toBeNull();
    scene.setLocked('ab' as never, false);
    expect(labelUnder(scene as never, at)).toEqual({ targetId: LABEL, labelId: LABEL, edgeId: 'ab' });
  });
});

describe('editEdgeLabelAction on a label', () => {
  it('edits the text on a double-click on the label', () => {
    const scene = load();
    const at = labelCenter(pathOf(scene), labelOf(scene), boxOf(scene, LABEL))!;
    const deps = { scene, nodeAtPoint: () => null } as unknown as ActionDeps;
    expect(editEdgeLabelAction().enabled!(deps, at)).toBe(true);
  });
});
