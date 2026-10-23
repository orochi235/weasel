import { createScene } from '@weasel-js/core';
import { HORIZONTAL_AXIS, isSymmetryGroup, readGroup, symmetryGroupSpec, VERTICAL_AXIS } from '@weasel-js/symmetry';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DRAW_REGISTRY, type DrawScene } from './drawDocument';
import { drawPrefs } from './prefs';
import { useSymmetry } from './useSymmetry';

const PAGE = { width: 600, height: 800 };

beforeEach(() => act(() => drawPrefs().reset()));

const newScene = (): DrawScene => createScene({ systemLayers: [{ id: 'default' }], registry: DRAW_REGISTRY });
const groups = (scene: DrawScene) => scene.renderOrderNodes().filter((n) => isSymmetryGroup(scene as never, n.id));
const insertInto = (r: { current: ReturnType<typeof useSymmetry> }) => r.current.contribution.deps!.insertInto!(() => undefined)!.get();

describe('useSymmetry', () => {
  it('starts off, drawing into nothing', () => {
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    expect(result.current.commands.symmetryOn).toBe(false);
    expect(groups(scene)).toHaveLength(0);
    expect(insertInto(result)).toBeNull();
  });

  it('turns on into a group at the page center, of the kind the axis preference names', () => {
    act(() => drawPrefs().set('view.symmetryAxis', 'both'));
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    act(() => result.current.commands.toggleSymmetry());
    expect(drawPrefs().get('view.symmetry')).toBe(true);
    const [group] = groups(scene);
    expect(insertInto(result)).toBe(group!.id);
    expect(readGroup(scene as never, group!.id)).toMatchObject({
      center: { x: 300, y: 400 }, spec: { kind: 'both', angle: HORIZONTAL_AXIS },
    });
  });

  it('turns the group it has when the axis preference changes, rather than making another', () => {
    act(() => drawPrefs().set('view.symmetry', true));
    const scene = newScene();
    renderHook(() => useSymmetry(scene, PAGE));
    act(() => drawPrefs().set('view.symmetryAxis', 'horizontal'));
    expect(groups(scene)).toHaveLength(1);
    expect(readGroup(scene as never, groups(scene)[0]!.id)?.spec).toMatchObject({ kind: 'mirror', angle: HORIZONTAL_AXIS });
  });

  it('draws into the group a reopened document already has', () => {
    const scene = newScene();
    const saved = scene.add(symmetryGroupSpec({ layer: 'default', center: { x: 10, y: 20 }, symmetry: { angle: VERTICAL_AXIS } }) as never);
    act(() => drawPrefs().set('view.symmetry', true));
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    expect(groups(scene)).toHaveLength(1);
    expect(insertInto(result)).toBe(saved);
  });

  it('turns off, keeping the group but drawing into nothing', () => {
    act(() => drawPrefs().set('view.symmetry', true));
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    act(() => result.current.commands.toggleSymmetry());
    expect(insertInto(result)).toBeNull();
    expect(groups(scene)).toHaveLength(1);
  });
});
