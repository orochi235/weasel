import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, createScene, type ActionDeps, type InvocationCtx, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from './edge';
import { edgeLabelSpec } from './edgeLabel';
import { LABEL_PLACEMENT, diagramLabelOf } from './labelTrait';
import { movedLabelData, type LabelEdit } from './labelDragAction';
import { createResetLabelAction, RESET_LABEL_ACTION_ID } from './labelCommands';

interface Rect { x: number; y: number; width: number; height: number }
type Sc = Scene<unknown, 'main', Rect>;

/** Boxes a, b and c, edges ab and bc, each labeled. */
function load(): Sc {
  const scene = createScene<unknown, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
  for (const [id, x] of [['a', 0], ['b', 300], ['c', 600]] as const) {
    scene.add({ id: id as never, kind: 'mark', layer: 'main', pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} } });
  }
  for (const [id, from, to] of [['ab', 'a', 'b'], ['bc', 'b', 'c']] as const) {
    scene.add({
      id: id as never, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: { nodeId: from }, to: { nodeId: to }, router: 'straight' } },
      dependsOn: [from as never, to as never], derivePath: EDGE_DERIVE_PATH as never,
    });
    scene.add(edgeLabelSpec(id, 'Yes', { layer: 'main' }) as never);
  }
  return scene;
}

/** What a committed drag leaves on the edge's label. */
function drag(scene: Sc, edge: string): void {
  const id = `${edge}/label` as never;
  scene.update(id, { data: movedLabelData(scene.get(id)!.data, { at: 0.3, offset: -20 }) as never });
}
const labelOf = (scene: Sc, edge: string) => diagramLabelOf(scene.get(`${edge}/label` as never)!)!;
const depsOf = (scene: Sc) => ({ scene }) as unknown as ActionDeps;

function run(scene: Sc, selected: string[], commit?: (edit: LabelEdit, ctx: InvocationCtx) => void): void {
  const invoker = createResetLabelAction({ selected: () => selected, ...(commit ? { commit } : {}) }).invoker!;
  if (invoker.timing !== 'immediate') throw new Error('expected an immediate invoker');
  invoker.run(depsOf(scene), undefined);
}

describe('createResetLabelAction', () => {
  it('has the id the contribution registers', () => {
    expect(createResetLabelAction({ selected: () => [] }).id).toBe(RESET_LABEL_ACTION_ID);
  });

  it('puts a dragged label back at LABEL_PLACEMENT, in one history entry', () => {
    const scene = load();
    drag(scene, 'ab');
    drag(scene, 'bc');
    const depth = scene.historyEntries().length;
    run(scene, ['ab', 'bc']);
    expect(labelOf(scene, 'ab')).toEqual(LABEL_PLACEMENT);
    expect(labelOf(scene, 'bc')).toEqual(LABEL_PLACEMENT);
    expect(scene.historyEntries().length).toBe(depth + 1);
    expect(scene.historyEntries().at(-1)?.label).toBe('Reset label');
    scene.undo();
    expect(labelOf(scene, 'ab').dodge).toBe(false);
    expect(labelOf(scene, 'bc').dodge).toBe(false);
  });

  it('is disabled for a locked dragged label and for one on a locked edge', () => {
    const scene = load();
    drag(scene, 'ab');
    const enabled = () => createResetLabelAction({ selected: () => ['ab'] }).enabled!(depsOf(scene));
    scene.setLocked('ab/label' as never, true);
    expect(enabled()).toBe(ActionDisabledReason.NotApplicable);
    scene.setLocked('ab/label' as never, false);
    scene.setLocked('ab' as never, true);
    expect(enabled()).toBe(ActionDisabledReason.NotApplicable);
  });

  it('resets only the unlocked label, in one history entry', () => {
    const scene = load();
    drag(scene, 'ab');
    drag(scene, 'bc');
    scene.setLocked('ab/label' as never, true);
    const depth = scene.historyEntries().length;
    run(scene, ['ab', 'bc']);
    expect(labelOf(scene, 'ab').dodge).toBe(false);
    expect(labelOf(scene, 'bc')).toEqual(LABEL_PLACEMENT);
    expect(scene.historyEntries().length).toBe(depth + 1);
  });

  it('is disabled with no edge selected, and for an edge whose label was never dragged', () => {
    const scene = load();
    drag(scene, 'bc');
    const enabled = (selected: string[]) => createResetLabelAction({ selected: () => selected }).enabled!(depsOf(scene));
    expect(enabled([])).toBe(ActionDisabledReason.NotApplicable);
    expect(enabled(['ab'])).toBe(ActionDisabledReason.NotApplicable);
    expect(enabled(['ab', 'bc'])).toBe(true);
  });

  it('reports placement null through commit', () => {
    const scene = load();
    drag(scene, 'ab');
    const commit = vi.fn();
    run(scene, ['ab', 'bc'], commit);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0]).toEqual({ labelId: 'ab/label', edgeId: 'ab', placement: null });
    expect((commit.mock.calls[0]![1] as InvocationCtx).deps.scene).toBe(scene);
  });
});
