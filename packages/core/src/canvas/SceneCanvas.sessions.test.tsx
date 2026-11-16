/**
 * Two `<SceneCanvas>`es over one scene: handed the scene and an `EditingSession` over it, each selects,
 * previews and undoes in its own session; handed the same session, both read one.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import type { History } from '@weasel-js/history';
import { useDepRegistry } from '@weasel-js/routing/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { createEditingSession } from 'core/scene/editingSession';
import { asNodeId, type Scene } from 'core/scene/types';
import type { SelectionApi } from '@weasel-js/routing';
import { selectionPreset } from '@weasel-js/editing';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

const A = asNodeId('a');
const B = asNodeId('b');
const box = (x: number): P => ({ x, y: 0, width: 10, height: 10 });

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.add({ id: A, kind: 'mark', layer: 'main', pose: box(0), data: { kind: 'rect' } });
  s.add({ id: B, kind: 'mark', layer: 'main', pose: box(20), data: { kind: 'rect' } });
  s.history.clear();
  return s;
}

interface Deps { selection: SelectionApi; scene: Scene<D, L, P>; history: History }

/** Reads a canvas's deps when asked, as an action does. */
function Probe({ into }: { into: { deps?: () => Deps } }) {
  const registry = useDepRegistry();
  into.deps = () => ({
    selection: registry.get('selection') as SelectionApi,
    scene: registry.get('scene') as Scene<D, L, P>,
    history: registry.get('history') as History,
  });
  return null;
}

function mountTwo(left: Scene<D, L, P>, right: Scene<D, L, P>) {
  const l: { deps?: () => Deps } = {};
  const r: { deps?: () => Deps } = {};
  render(
    <>
      <SceneCanvas<D, L, P> features={[selectionPreset]} scene={left} width={200} height={200} selectionOptions={{ mode: 'multi' }}>
        <Probe into={l} />
      </SceneCanvas>
      <SceneCanvas<D, L, P> features={[selectionPreset]} scene={right} width={200} height={200} selectionOptions={{ mode: 'multi' }}>
        <Probe into={r} />
      </SceneCanvas>
    </>,
  );
  return { left: l.deps!, right: r.deps! };
}

describe('<SceneCanvas> over editing sessions', () => {
  it('a canvas handed a session selects in that session, apart from one handed the scene', () => {
    const scene = makeScene();
    const session = createEditingSession(scene);
    const { left, right } = mountTwo(scene, session);

    act(() => left().selection.set([A]));
    act(() => right().selection.set([B]));

    expect(scene.getSelection()).toEqual([A]);
    expect(session.getSelection()).toEqual([B]);
    expect(left().selection.get()).toEqual([A]);
    expect(right().selection.get()).toEqual([B]);
  });

  it('its actions preview through the session they were handed', () => {
    const scene = makeScene();
    const session = createEditingSession(scene);
    const { left, right } = mountTwo(scene, session);

    act(() => right().scene.overrides.set(A, { pose: box(90) }));
    expect(session.overrides.has(A)).toBe(true);
    expect(left().scene.overrides.has(A)).toBe(false);
  });

  it('an undo through a canvas restores its own session\'s selection', () => {
    const scene = makeScene();
    const session = createEditingSession(scene);
    const { left, right } = mountTwo(scene, session);
    act(() => left().selection.set([A]));
    act(() => right().selection.set([B]));
    act(() => { right().scene.setPose(B, box(60)); });
    act(() => right().selection.set([]));

    act(() => { right().history.undo(); });
    expect(scene.get(B)!.pose).toEqual(box(20));
    expect(session.getSelection()).toEqual([B]);
    expect(scene.getSelection()).toEqual([A]);
  });

  it('two canvases handed one session share its selection', () => {
    const scene = makeScene();
    const session = createEditingSession(scene);
    const { left, right } = mountTwo(session, session);

    act(() => left().selection.set([A, B]));
    expect(right().selection.get()).toEqual([A, B]);
    expect(scene.getSelection()).toEqual([]);
  });
});
