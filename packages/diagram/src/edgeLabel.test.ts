import { describe, it, expect, vi } from 'vitest';
import { createScene, type ActionDeps, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from './edge';
import {
  EDIT_EDGE_LABEL_ACTION_ID, edgeLabelSpec, editEdgeLabelAction, editEdgeLabelBinding,
} from './edgeLabel';
import { LABEL_DERIVE_POSE } from './label';
import { diagramScene } from './fromData';

interface Rect { x: number; y: number; width: number; height: number }
type Sc = Scene<unknown, 'main', Rect>;

function sceneWithEdge(withLabel = false): Sc {
  const scene = createScene<unknown, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
  for (const [id, x] of [['a', 0], ['b', 300]] as const) {
    scene.add({ id: id as never, kind: 'leaf', layer: 'main', pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} } });
  }
  scene.add({
    id: 'e1' as never, kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { diagram: { from: { nodeId: 'a' }, to: { nodeId: 'b' }, router: 'straight' } },
    dependsOn: ['a' as never, 'b' as never], derivePath: EDGE_DERIVE_PATH as never,
  });
  if (withLabel) scene.add(edgeLabelSpec('e1', 'hi', { layer: 'main' }) as never);
  return scene;
}

function runOn(action: ReturnType<typeof editEdgeLabelAction>, deps: ActionDeps, at = { x: 150, y: 20 }) {
  if (action.invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
  action.invoker.run(deps, { worldX: at.x, worldY: at.y });
}

const depsOf = (scene: Sc, extra: object = {}, under: string | null = 'e1') =>
  ({ scene, nodeAtPoint: () => under, ...extra }) as unknown as ActionDeps;

describe('edgeLabelSpec', () => {
  it('names the label after its edge, depends on it, and derives its pose', () => {
    const spec = edgeLabelSpec('e1', 'weight', { layer: 'main' });
    expect(spec).toMatchObject({
      id: 'e1/label', kind: 'leaf', layer: 'main', pickable: false, dependsOn: ['e1'],
      derivePose: LABEL_DERIVE_POSE,
      data: { diagram: { label: { at: 'mid', offset: 9 } }, text: 'weight' },
    });
  });

  it('sizes the box from the measure it is given, in the style it is given', () => {
    const measure = vi.fn(() => ({ width: 42, height: 9 }));
    const style = { fontFamily: 'serif', fontSize: 10 };
    const spec = edgeLabelSpec('e1', 'x', { layer: 'main', measure, style, label: { at: 'end' }, fill: '#f00' });
    expect(measure).toHaveBeenCalledWith('x', style);
    expect(spec.pose).toEqual({ x: 0, y: 0, width: 42, height: 10 });
    expect(spec.data).toMatchObject({ diagram: { label: { at: 'end' } }, style, fill: { paint: { color: '#f00' } } });
  });
});

describe('diagramScene labels', () => {
  it("builds a labeled edge's label node through the helper", () => {
    const specs = diagramScene({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ id: 'e', from: 'a', to: 'b', label: 'w' }] });
    const label = specs.find((s) => s.id === 'e/label')!;
    expect(label).toMatchObject({
      kind: 'leaf', layer: 'main', pickable: false, dependsOn: ['e'], derivePose: LABEL_DERIVE_POSE,
      data: { diagram: { label: { at: 'mid', offset: 9 } }, text: 'w', style: { fontFamily: 'sans-serif', fontSize: 10 } },
    });
  });
});

describe('editEdgeLabelAction', () => {
  it('binds a double-click', () => {
    expect(editEdgeLabelBinding()).toMatchObject({ spec: { kind: 'doubleClick' }, actionId: EDIT_EDGE_LABEL_ACTION_ID });
    expect(editEdgeLabelAction().id).toBe(EDIT_EDGE_LABEL_ACTION_ID);
  });

  it('adds a label to an unlabeled edge in one history entry, then begins editing it', () => {
    const scene = sceneWithEdge();
    const before = scene.renderOrderNodes().length;
    const startEdit = vi.fn();
    runOn(editEdgeLabelAction(), depsOf(scene, { textEdit: { startEdit } }));
    expect(scene.renderOrderNodes()).toHaveLength(before + 1);
    expect(scene.get('e1/label' as never)).toBeDefined();
    expect(startEdit).toHaveBeenCalledWith('e1/label');
    expect(scene.undo()).toBe(true);
    expect(scene.renderOrderNodes()).toHaveLength(before);
  });

  it('adds nothing to a labeled edge and begins on the existing label', () => {
    const scene = sceneWithEdge(true);
    const before = scene.renderOrderNodes().length;
    const startEdit = vi.fn();
    runOn(editEdgeLabelAction(), depsOf(scene, { textEdit: { startEdit } }));
    expect(scene.renderOrderNodes()).toHaveLength(before);
    expect(startEdit).toHaveBeenCalledWith('e1/label');
  });

  it('hands the edge id to a custom commit instead of editing', () => {
    const scene = sceneWithEdge();
    const commit = vi.fn();
    const deps = depsOf(scene);
    runOn(editEdgeLabelAction({ commit }), deps);
    expect(commit).toHaveBeenCalledWith('e1', expect.objectContaining({ deps }));
    expect(scene.get('e1/label' as never)).toBeUndefined();
  });

  it('declines a double-click that is not on an edge', () => {
    const scene = sceneWithEdge();
    const action = editEdgeLabelAction();
    expect(action.enabled?.(depsOf(scene, {}, 'a'), { x: 10, y: 10 })).not.toBe(true);
    expect(action.enabled?.(depsOf(scene), { x: 150, y: 20 })).toBe(true);
  });
});
