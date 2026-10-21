/**
 * Which mode a double-click on the canvas enters in draw, through a real `<SceneCanvas>` wired the
 * way Workspace wires it: `useCanvasModes`, the machine's path-edit host, and the scoping dim's
 * `isPointerInteractive`, which the canvas's hit-test honors.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useState, type ReactElement } from 'react';
import { createScopingDim, DEFAULT_MODES } from '@weasel-js/modes';
import { SceneCanvas, asNodeId, createScene, hasEditablePath, pathFromD, solid, useSelection, type PolygonPath } from '@weasel-js/core';
import type { DrawScene } from '../drawDocument';
import { createModeMachine, type ModeMachine } from './machine';
import { modeScopeIds } from './modeScope';
import { modePathEdit } from './pathEditHost';
import { useCanvasModes } from './useCanvasModes';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
}

const square = (x: number) => ({ x, y: 0, width: 30, height: 30 });
/** Left edge of each node; a double-click lands 15px in. `group` spans `member` and `inner`, whose
 *  one child is `deep`. */
const AT = { anchored: 0, anchorless: 40, text: 80, member: 120, deep: 160, empty: 200 } as const;

function Harness({ machine }: { machine: ModeMachine }): ReactElement {
  const [scene] = useState(() => {
    const s = createScene({ systemLayers: [{ id: 'main' }] });
    const leaf = (id: string, x: number, data: unknown) =>
      s.add({ id: asNodeId(id), kind: 'leaf', layer: 'main', data, pose: square(x) } as never);
    leaf('anchored', AT.anchored, { path: pathFromD('M 0 0 L 30 0 L 30 30 L 0 30 Z') as PolygonPath, fill: { paint: solid('#888') } });
    // Routed as a `path`, drawn and picked as its commands, and of a kind path edit cannot open.
    const outline = pathFromD('M 0 0 L 30 0 L 30 30 L 0 30 Z') as PolygonPath;
    leaf('anchorless', AT.anchorless, { path: { ...outline, kind: 'spiro' }, fill: { paint: solid('#888') } });
    leaf('text', AT.text, { text: 'hello' });
    const container = (id: string, parent: string | undefined, x: number, width: number) => s.add({
      id: asNodeId(id), kind: 'container', layer: 'main', data: {}, pose: { ...square(x), width },
      ...(parent ? { parent: asNodeId(parent) } : {}),
    } as never);
    const member = (id: string, parent: string, x: number) => s.add({
      id: asNodeId(id), kind: 'leaf', layer: 'main', parent: asNodeId(parent),
      data: { path: pathFromD('M 0 0 L 30 0 L 30 30 Z') as PolygonPath, fill: { paint: solid('#888') } }, pose: square(x),
    } as never);
    container('group', undefined, AT.member, 70);
    member('member', 'group', AT.member);
    container('inner', 'group', AT.deep, 30);
    member('deep', 'inner', AT.deep);
    return s as unknown as DrawScene;
  });
  const selection = useSelection({ mode: 'multi', scene });
  const [pathEdit] = useState(() => modePathEdit(machine, (id) => hasEditablePath(scene.get(asNodeId(id)))));
  const [dim] = useState(() => createScopingDim({
    registry: machine.registry,
    getTargetIds: () => modeScopeIds(machine, scene),
  }));
  const modes = useCanvasModes(machine, scene, selection, pathEdit);
  return (
    <SceneCanvas features={['draw']} scene={scene} selection={selection} layers={{}} width={240} height={60}
      ambient={modes.ambient}
      isPointerInteractive={dim.isPointerInteractive}
      isolatedGroup={modes.isolatedGroup}
      modes={machine.registry}
      pathEdit={modes.pathEdit} />
  );
}

function setup() {
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
  render(<Harness machine={machine} />);
  const doubleClick = (x: number) => {
    const canvas = document.querySelector('canvas')!;
    const press = (type: string) =>
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x + 15, clientY: 15, pointerId: 1 }));
    act(() => { press('pointerdown'); press('pointerup'); press('pointerdown'); press('pointerup'); });
  };
  const state = () => ({ mode: machine.registry.current().id, target: machine.getActiveTargetId() });
  return { machine, doubleClick, state };
}

describe('double-click mode entry in draw', () => {
  it('a path with anchors enters path-edit on it', () => {
    const t = setup();
    t.doubleClick(AT.anchored);
    expect(t.state()).toEqual({ mode: 'path-edit', target: 'anchored' });
  });

  it('a path with no anchors enters path-edit on it too', () => {
    const t = setup();
    t.doubleClick(AT.anchorless);
    expect(t.state()).toEqual({ mode: 'path-edit', target: 'anchorless' });
  });

  it('text enters no mode: the edit opening is what enters text-edit', () => {
    const t = setup();
    t.doubleClick(AT.text);
    expect(t.state()).toEqual({ mode: 'normal', target: null });
  });

  it('a grouped path names its group: isolation on the group', () => {
    const t = setup();
    t.doubleClick(AT.member);
    expect(t.state()).toEqual({ mode: 'isolation', target: 'group' });
  });

  it('a path two groups deep names the outermost group first', () => {
    const t = setup();
    t.doubleClick(AT.deep);
    expect(t.state()).toEqual({ mode: 'isolation', target: 'group' });
  });

  it('inside the isolated group, a double-click names the next group in', () => {
    const t = setup();
    t.doubleClick(AT.deep);
    t.doubleClick(AT.deep);
    expect(t.state()).toEqual({ mode: 'isolation', target: 'inner' });
    t.doubleClick(AT.deep);
    expect(t.state()).toEqual({ mode: 'path-edit', target: 'deep' });
  });

  it('inside the isolated group, a path in no further group leaves isolation for path-edit', () => {
    const t = setup();
    t.doubleClick(AT.member);
    t.doubleClick(AT.member);
    expect(t.state()).toEqual({ mode: 'path-edit', target: 'member' });
  });

  it('empty canvas enters no mode', () => {
    const t = setup();
    t.doubleClick(AT.empty);
    expect(t.state()).toEqual({ mode: 'normal', target: null });
  });

  it('a path with no anchors leaves a strict mode alone', () => {
    const t = setup();
    act(() => t.machine.enterMode('crop', {}));
    t.doubleClick(AT.anchorless);
    expect(t.state()).toEqual({ mode: 'crop', target: null });
  });

  it('a path with no anchors that path-edit on another path dims enters nothing', () => {
    const t = setup();
    t.doubleClick(AT.anchored);
    t.doubleClick(AT.anchorless);
    expect(t.state()).toEqual({ mode: 'path-edit', target: 'anchored' });
  });

  it('a path with no anchors that isolation dims enters nothing', () => {
    const t = setup();
    act(() => t.machine.enterMode('isolation', { targetId: 'group' }));
    t.doubleClick(AT.anchorless);
    expect(t.state()).toEqual({ mode: 'isolation', target: 'group' });
  });
});
