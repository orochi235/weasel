/**
 * The route and label commits on a scene `diagramScene` built, against a model of the scene's data and its undo
 * stack, through `fc.commands`: route edits, label moves and resets, undos, and redos. Each commit that changes
 * something is one undo entry and leaves the edge owning its route; one that changes nothing records nothing; undo
 * and redo restore every node's data exactly.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScene, type InvocationCtx, type RectPose, type Scene } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { withDiagramRegistry } from './edge';
import { edgeLabelIdOf } from './edgeLabel';
import { edgeIdOf } from './edgeId';
import type { DiagramEdge } from './edgeTrait';
import { diagramScene } from './fromData';
import { commitLabelToScene } from './labelDragAction';
import type { DiagramLabel } from './labelTrait';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { commitRouteToScene } from './waypointAction';

const RUNS = 80;

type AnyScene = Scene<unknown, 'main', RectPose>;
interface Model { stack: Map<string, unknown>[]; at: number }
interface Real { scene: AnyScene; ctx: InvocationCtx }

const EDGES = [{ from: 'a', to: 'b', label: 'x' }, { from: 'b', to: 'c', label: 'y', waypoints: [{ x: 50, y: 300 }] }, { from: 'a', to: 'c' }];
const EDGE_IDS = EDGES.map(edgeIdOf);
const LABELED = EDGES.filter((e) => e.label !== undefined).map(edgeIdOf);

const dataOf = (scene: AnyScene) => new Map([...scene.renderOrderNodes()].map((n) => [n.id as string, structuredClone(n.data)]));

function settle(model: Model, scene: AnyScene, before: number, changed: boolean): void {
  expect(scene.historyIndex()).toBe(changed ? before + 1 : before);
  if (changed) {
    model.stack.length = model.at + 1;
    model.stack.push(dataOf(scene));
    model.at++;
  }
  expect(dataOf(scene)).toEqual(model.stack[model.at]);
}

class Route implements fc.Command<Model, Real> {
  constructor(readonly edge: string, readonly waypoints: Vec2[]) {}
  check = () => true;
  run(model: Model, { scene, ctx }: Real): void {
    const was = (scene.get(this.edge as never)!.data as { diagram: DiagramEdge }).diagram;
    const changed = was.laidOut !== undefined || JSON.stringify(was.waypoints ?? []) !== JSON.stringify(this.waypoints);
    const before = scene.historyIndex();
    commitRouteToScene({ edgeId: this.edge, waypoints: this.waypoints }, ctx);
    const now = (scene.get(this.edge as never)!.data as { diagram: DiagramEdge }).diagram;
    expect(now.laidOut).toBeUndefined();
    expect(now.waypoints ?? []).toEqual(this.waypoints);
    settle(model, scene, before, changed);
  }
  toString = () => `route ${this.edge} ${JSON.stringify(this.waypoints)}`;
}

class Label implements fc.Command<Model, Real> {
  constructor(readonly edge: string, readonly placement: DiagramLabel | null) {}
  check = () => true;
  run(model: Model, { scene, ctx }: Real): void {
    const id = edgeLabelIdOf(this.edge);
    const was = structuredClone(scene.get(id as never)!.data);
    const before = scene.historyIndex();
    commitLabelToScene({ labelId: id, edgeId: this.edge, placement: this.placement }, ctx);
    const changed = JSON.stringify(scene.get(id as never)!.data) !== JSON.stringify(was);
    settle(model, scene, before, changed);
  }
  toString = () => `label ${this.edge} ${JSON.stringify(this.placement)}`;
}

class Undo implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>) => m.at > 0;
  run(model: Model, { scene }: Real): void {
    expect(scene.undo()).toBe(true);
    model.at--;
    expect(dataOf(scene)).toEqual(model.stack[model.at]);
  }
  toString = () => 'undo';
}

class Redo implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>) => m.at < m.stack.length - 1;
  run(model: Model, { scene }: Real): void {
    expect(scene.redo()).toBe(true);
    model.at++;
    expect(dataOf(scene)).toEqual(model.stack[model.at]);
  }
  toString = () => 'redo';
}

const pt = fc.record({ x: fc.integer({ min: 0, max: 3 }).map((n) => n * 50), y: fc.integer({ min: 0, max: 3 }).map((n) => n * 50) });
const placement: fc.Arbitrary<DiagramLabel | null> = fc.option(fc.record({
  at: fc.oneof(fc.constantFrom('mid', 'start', 'end') as fc.Arbitrary<DiagramLabel['at']>, fc.constantFrom(0, 0.25, 0.5) as fc.Arbitrary<DiagramLabel['at']>),
  offset: fc.constantFrom(0, 9, -6),
  dodge: fc.constant(false),
}), { freq: 4 }) as fc.Arbitrary<DiagramLabel | null>;

const commands = [
  fc.tuple(fc.constantFrom(...EDGE_IDS), fc.array(pt, { maxLength: 2 })).map(([e, w]) => new Route(e, w)),
  fc.tuple(fc.constantFrom(...LABELED), placement).map(([e, p]) => new Label(e, p)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
];

describe('route and label commits in a scene', () => {
  it('are one undo entry each when they change something, none when not, and undo exactly', () => {
    const seen = tally();
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 20 }), (cmds) => {
      const scene = createScene<unknown, 'main', RectPose>({
        systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(),
        initial: diagramScene({ nodes: ['a', 'b', 'c'].map((id) => ({ id, lines: [id] })), edges: EDGES }) as never,
      }) as AnyScene;
      const model: Model = { stack: [dataOf(scene)], at: 0 };
      const ctx = { deps: { scene } } as unknown as InvocationCtx;
      fc.modelRun(() => ({ model, real: { scene, ctx } }), cmds);
      if (model.stack.length > 3) seen.count('edited');
      if ([...cmds].some((c) => String(c) === 'undo')) seen.count('undone');
    }), runs(RUNS));
    seen.atLeast('edited', RUNS / 3);
    seen.atLeast('undone', RUNS / 3);
  }, timeoutFor(RUNS, 50));
});
