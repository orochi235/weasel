import { createPageRun, createScene, placedPagesOf } from '@weasel-js/core';
import { HORIZONTAL_AXIS, isSymmetryGroup, symmetryOf, symmetryGroupSpec, VERTICAL_AXIS } from '@weasel-js/symmetry';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DRAW_REGISTRY, type DrawScene } from './drawDocument';
import { onePage, replacePages } from './pages/drawPages';
import { drawPrefs } from './prefs';
import { useSymmetry } from './useSymmetry';

const PAGE = { width: 600, height: 800 };

beforeEach(() => act(() => drawPrefs().reset()));

const newScene = (): DrawScene => createScene({ systemLayers: [{ id: 'default' }], registry: DRAW_REGISTRY });
const groups = (scene: DrawScene) => scene.renderOrderNodes().filter((n) => isSymmetryGroup(scene as never, n.id));
const insertInto = (r: { current: ReturnType<typeof useSymmetry> }) => r.current.contribution.deps!.insertInto!(() => undefined)!.get();

type Hook = { current: ReturnType<typeof useSymmetry> };
const toggle = (r: Hook) => act(() => r.current.commands.toggleSymmetry());
const isOn = (r: Hook) => r.current.commands.symmetryOn;

describe('useSymmetry', () => {
  it('starts off, drawing into nothing', () => {
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    expect(isOn(result)).toBe(false);
    expect(groups(scene)).toHaveLength(0);
    expect(insertInto(result)).toBeNull();
  });

  it('turns on into a group at the page center, of the kind the axis preference names', () => {
    act(() => drawPrefs().set('view.symmetry.axis', 'both'));
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    toggle(result);
    expect(isOn(result)).toBe(true);
    const [group] = groups(scene);
    expect(insertInto(result)).toBe(group!.id);
    expect(symmetryOf(scene as never, group!.id)).toMatchObject({
      center: { x: 300, y: 400 }, spec: { kind: 'both', angle: HORIZONTAL_AXIS },
    });
  });

  it('starts off again in a new session', () => {
    const scene = newScene();
    const first = renderHook(() => useSymmetry(scene, PAGE));
    toggle(first.result);
    first.unmount();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    expect(isOn(result)).toBe(false);
    expect(insertInto(result)).toBeNull();
  });

  it('turns the group it has when the axis preference changes, rather than making another', () => {
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    toggle(result);
    act(() => drawPrefs().set('view.symmetry.axis', 'horizontal'));
    expect(groups(scene)).toHaveLength(1);
    expect(symmetryOf(scene as never, groups(scene)[0]!.id)?.spec).toMatchObject({ kind: 'mirror', angle: HORIZONTAL_AXIS });
  });

  it('draws into the group a reopened document already has', () => {
    const scene = newScene();
    const saved = scene.add(symmetryGroupSpec({ layer: 'default', center: { x: 10, y: 20 }, symmetry: { angle: VERTICAL_AXIS } }) as never);
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    toggle(result);
    expect(groups(scene)).toHaveLength(1);
    expect(insertInto(result)).toBe(saved);
  });

  it('turns off, keeping the group but drawing into nothing', () => {
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    toggle(result);
    toggle(result);
    expect(isOn(result)).toBe(false);
    expect(insertInto(result)).toBeNull();
    expect(groups(scene)).toHaveLength(1);
  });

  it('makes the group on the shown page, at its center, and finds it there again', () => {
    const scene = newScene();
    createPageRun(scene, [{ id: 'p1', ...PAGE }, { id: 'p2', ...PAGE }]);
    const p2 = placedPagesOf(scene)[1]!;
    const first = renderHook(() => useSymmetry(scene, p2));
    toggle(first.result);
    const [group] = groups(scene);
    expect(group!.parent).toBe('p2');
    expect(p2.x).not.toBe(0);
    expect(symmetryOf(scene as never, group!.id)?.center).toEqual({ x: p2.x + 300, y: p2.y + 400 });
    // Stored in the page's frame.
    expect(scene.get(group!.id)!.pose).toMatchObject({ x: 300, y: 400 });
    first.unmount();
    const { result } = renderHook(() => useSymmetry(scene, p2));
    toggle(result);
    expect(groups(scene)).toHaveLength(1);
    expect(insertInto(result)).toBe(group!.id);
  });

  it('turns off when undo steps past its group\'s making, and stays off on redo', () => {
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    toggle(result);
    const [made] = groups(scene);
    act(() => { scene.undo(); });
    expect(groups(scene)).toHaveLength(0);
    expect(isOn(result)).toBe(false);
    expect(insertInto(result)).toBeNull();
    act(() => { scene.redo(); });
    expect(isOn(result)).toBe(false);
    expect(insertInto(result)).toBeNull();
    toggle(result);
    expect(groups(scene)).toHaveLength(1);
    expect(insertInto(result)).toBe(made!.id);
  });

  it('turns off when its group is deleted, and stays off when the delete is undone', () => {
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    toggle(result);
    const [group] = groups(scene);
    act(() => { scene.batch('Delete', () => { scene.remove(group!.id); }); });
    expect(isOn(result)).toBe(false);
    expect(groups(scene)).toHaveLength(0);
    expect(insertInto(result)).toBeNull();
    act(() => { scene.undo(); });
    expect(isOn(result)).toBe(false);
    expect(insertInto(result)).toBeNull();
  });

  it('turns off when the page its group is on is deleted', () => {
    const scene = newScene();
    createPageRun(scene, [{ id: 'p1', ...PAGE }, { id: 'p2', ...PAGE }]);
    const { result } = renderHook(() => useSymmetry(scene, placedPagesOf(scene)[0]!));
    toggle(result);
    act(() => { scene.batch('Delete page', () => { scene.remove('p1' as never); }); });
    expect(isOn(result)).toBe(false);
    expect(groups(scene)).toHaveLength(0);
  });

  it('turns off on New, making no group in the new document, and stays off on undo', () => {
    const scene = newScene();
    createPageRun(scene, [{ id: 'page-1', ...PAGE }]);
    const { result } = renderHook(() => useSymmetry(scene, placedPagesOf(scene)[0]!));
    toggle(result);
    act(() => scene.batch('New document', () => replacePages(scene, onePage(PAGE))));
    expect(isOn(result)).toBe(false);
    expect(groups(scene)).toHaveLength(0);
    expect(insertInto(result)).toBeNull();
    act(() => { scene.undo(); });
    expect(groups(scene)).toHaveLength(1);
    expect(isOn(result)).toBe(false);
  });
});
