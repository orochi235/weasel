/**
 * The select tool's modifier clicks under the selection's default keys: Cmd (Ctrl off macOS)
 * toggles the pressed node, and Shift selects every node whose center lies in the box the last
 * node clicked and the pressed one span. Runs on a Mac platform so Cmd is the toggle key.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Action, ActionDeps } from '@weasel-js/routing';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { createScene } from 'core/scene/scene';
import { makeFrameFixture } from 'core/scene/frameFixture';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool } from './useSelectTool';

type Mods = { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean };
const NO_MODS: Mods = { alt: false, ctrl: false, meta: false, shift: false };
const CMD = { meta: true };
const SHIFT = { shift: true };

beforeEach(() => { vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel'); });
afterEach(() => { vi.restoreAllMocks(); });

const rect = (x: number, y: number, width = 10, height = 10, rotation?: number): RectPose =>
  ({ x, y, width, height, ...(rotation === undefined ? {} : { rotation }) });

type AnyScene = Scene<unknown, 'main', RectPose>;

function sceneOf(nodes: { id: string; kind?: 'mark' | 'group'; pose: RectPose; parent?: string }[]): AnyScene {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const n of nodes) {
    scene.add({
      id: asNodeId(n.id), kind: n.kind ?? 'mark', layer: 'main', data: {}, pose: n.pose,
      ...(n.parent ? { parent: asNodeId(n.parent) } : {}),
    });
  }
  return scene;
}

function harness(scene: AnyScene, entered: string | null = null) {
  const { result } = renderHook(() => {
    const sel = useSelection({ mode: 'multi' });
    const adapter = sceneToAdapter(scene, { selection: sel });
    return { tool: useSelectTool(adapter as never, {}), sel };
  });
  const run = (actionId: string, x: number, y: number, mods: Partial<Mods>) => {
    const invoker = (result.current.tool as { actions?: readonly Action[] }).actions
      ?.find((a) => a.id === actionId)?.invoker;
    if (invoker?.timing !== 'immediate') throw new Error(`${actionId} missing`);
    act(() => {
      invoker.run(
        { selection: result.current.sel, enteredGroup: { get: () => entered } } as unknown as ActionDeps,
        { world: { x, y }, mods: { ...NO_MODS, ...mods } },
      );
    });
  };
  return {
    pick: (x: number, y: number, mods: Partial<Mods> = {}) => run('select.pick', x, y, mods),
    deep: (x: number, y: number, mods: Partial<Mods> = {}) => run('select.deep', x, y, { meta: true, alt: true, ...mods }),
    selection: () => [...result.current.sel.current].sort(),
  };
}

describe('Cmd-click', () => {
  it('adds the pressed node, and takes it out again', () => {
    const h = harness(sceneOf([{ id: 'a', pose: rect(0, 0) }, { id: 'b', pose: rect(50, 0) }]));
    h.pick(5, 5);
    h.pick(55, 5, CMD);
    expect(h.selection()).toEqual(['a', 'b']);
    h.pick(5, 5, CMD);
    expect(h.selection()).toEqual(['b']);
  });

  it('on a member of a multi-selection takes it out on the press', () => {
    const h = harness(sceneOf([{ id: 'a', pose: rect(0, 0) }, { id: 'b', pose: rect(50, 0) }]));
    h.pick(5, 5);
    h.pick(55, 5, CMD);
    h.pick(55, 5, CMD);
    expect(h.selection()).toEqual(['a']);
  });
});

describe('Shift-click', () => {
  // a at the top left, d at the bottom right; b and c between them, e outside the box they span.
  const grid = () => sceneOf([
    { id: 'a', pose: rect(0, 0) },
    { id: 'b', pose: rect(40, 0) },
    { id: 'c', pose: rect(20, 30) },
    { id: 'd', pose: rect(60, 60) },
    { id: 'e', pose: rect(100, 30) },
  ]);

  it('selects every node whose center lies in the box the last node clicked and the pressed one span', () => {
    const h = harness(grid());
    h.pick(5, 5);
    h.pick(65, 65, SHIFT);
    expect(h.selection()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('swings from the same anchor on the next Shift-click', () => {
    const h = harness(grid());
    h.pick(5, 5);
    h.pick(65, 65, SHIFT);
    h.pick(45, 5, SHIFT);
    expect(h.selection()).toEqual(['a', 'b']);
  });

  it('ranges from the last node a Cmd-click toggled', () => {
    const h = harness(grid());
    h.pick(5, 5);
    h.pick(45, 5, CMD);
    h.pick(65, 65, SHIFT);
    expect(h.selection()).toEqual(['b', 'd']);
  });

  it('leaves out a node whose box reaches into the span but whose center does not', () => {
    const h = harness(sceneOf([
      { id: 'a', pose: rect(0, 0) },
      { id: 'b', pose: rect(40, 40) },
      { id: 'wide', pose: rect(45, 0, 100, 10) },
    ]));
    h.pick(5, 5);
    h.pick(45, 45, SHIFT);
    expect(h.selection()).toEqual(['a', 'b']);
  });

  it('takes a group whose center lies in the span whole, and none of its members, whatever kind they are', () => {
    const h = harness(sceneOf([
      { id: 'a', pose: rect(0, 0) },
      { id: 'g', kind: 'group', pose: rect(20, 20, 20, 20) },
      { id: 'g1', pose: rect(20, 20), parent: 'g' },
      { id: 'g2', pose: rect(30, 30), parent: 'g' },
      { id: 'd', pose: rect(60, 60) },
    ]));
    h.pick(5, 5);
    h.pick(65, 65, SHIFT);
    expect(h.selection()).toEqual(['a', 'd', 'g']);
  });

  it('spans the box a rotated node is drawn in, not its unrotated pose', () => {
    // `bar` is 100 wide and 10 tall about (50, 50), turned upright: it is drawn from y 0 to 100,
    // x 45 to 55. Unturned it would span x 0 to 100, y 45 to 55.
    const h = harness(sceneOf([
      { id: 'bar', pose: rect(0, 45, 100, 10, Math.PI / 2) },
      { id: 'end', pose: rect(60, 90) },
      { id: 'inUpright', pose: rect(46, 15) },
      { id: 'inFlat', pose: rect(15, 60) },
    ]));
    h.pick(50, 50);
    h.pick(65, 95, SHIFT);
    expect(h.selection()).toEqual(['bar', 'end', 'inUpright']);
  });

  it('reads each node at its world center inside a turned frame', () => {
    // The fixture's group is turned a quarter turn: `a` is drawn about (75, 20) and `b` about
    // (30, 60), so the span is x 10 to 80, y 10 to 70. `c` sits at local (40, 50), drawn at
    // (50, 40), inside it; `d` at local (30, 10), inside it too, but drawn at (90, 30), outside.
    const scene = makeFrameFixture() as unknown as AnyScene;
    scene.add({ id: asNodeId('c'), kind: 'mark', layer: 'main', data: {}, pose: rect(35, 45), parent: asNodeId('g') });
    scene.add({ id: asNodeId('d'), kind: 'mark', layer: 'main', data: {}, pose: rect(25, 5), parent: asNodeId('g') });
    const h = harness(scene, 'g');
    h.pick(75, 20);
    h.pick(30, 60, SHIFT);
    expect(h.selection()).toEqual(['a', 'b', 'c']);
  });
});

describe('Cmd+Alt-click', () => {
  it('selects the member itself, past its group', () => {
    const h = harness(sceneOf([
      { id: 'g', kind: 'group', pose: rect(0, 0, 40, 40) },
      { id: 'm', pose: rect(0, 0), parent: 'g' },
    ]));
    h.deep(5, 5);
    expect(h.selection()).toEqual(['m']);
  });

  it('with Shift, ranges among the members of the pressed one\'s group', () => {
    const h = harness(sceneOf([
      { id: 'g', kind: 'group', pose: rect(0, 0, 70, 70) },
      { id: 'm1', pose: rect(0, 0), parent: 'g' },
      { id: 'm2', pose: rect(30, 30), parent: 'g' },
      { id: 'm3', pose: rect(60, 60), parent: 'g' },
    ]));
    h.deep(5, 5);
    h.deep(65, 65, SHIFT);
    expect(h.selection()).toEqual(['m1', 'm2', 'm3']);
  });
});
