import { createPageRun, createScene, placedPagesOf } from '@weasel-js/core';
import { HORIZONTAL_AXIS, isSymmetryGroup, symmetryOf, symmetryGroupSpec, VERTICAL_AXIS } from '@weasel-js/symmetry';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DRAW_REGISTRY, type DrawScene } from './drawDocument';
import { onePage, replacePages } from './pages/drawPages';
import { drawPrefs } from './prefs';
import { useSymmetry } from './useSymmetry';

const PAGE = { width: 600, height: 800 };
const MARK = { kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} };

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
    act(() => drawPrefs().set('view.symmetry.axis', 'both'));
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    act(() => result.current.commands.toggleSymmetry());
    expect(drawPrefs().get('view.symmetry.on')).toBe(true);
    const [group] = groups(scene);
    expect(insertInto(result)).toBe(group!.id);
    expect(symmetryOf(scene as never, group!.id)).toMatchObject({
      center: { x: 300, y: 400 }, spec: { kind: 'both', angle: HORIZONTAL_AXIS },
    });
  });

  it('turns the group it has when the axis preference changes, rather than making another', () => {
    act(() => drawPrefs().set('view.symmetry.on', true));
    const scene = newScene();
    renderHook(() => useSymmetry(scene, PAGE));
    act(() => drawPrefs().set('view.symmetry.axis', 'horizontal'));
    expect(groups(scene)).toHaveLength(1);
    expect(symmetryOf(scene as never, groups(scene)[0]!.id)?.spec).toMatchObject({ kind: 'mirror', angle: HORIZONTAL_AXIS });
  });

  it('draws into the group a reopened document already has', () => {
    const scene = newScene();
    const saved = scene.add(symmetryGroupSpec({ layer: 'default', center: { x: 10, y: 20 }, symmetry: { angle: VERTICAL_AXIS } }) as never);
    act(() => drawPrefs().set('view.symmetry.on', true));
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    expect(groups(scene)).toHaveLength(1);
    expect(insertInto(result)).toBe(saved);
  });

  it('turns off, keeping the group but drawing into nothing', () => {
    act(() => drawPrefs().set('view.symmetry.on', true));
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    act(() => result.current.commands.toggleSymmetry());
    expect(insertInto(result)).toBeNull();
    expect(groups(scene)).toHaveLength(1);
  });

  it('makes the group on the shown page, at its center, and finds it there again', () => {
    act(() => drawPrefs().set('view.symmetry.on', true));
    const scene = newScene();
    createPageRun(scene, [{ id: 'p1', ...PAGE }, { id: 'p2', ...PAGE }]);
    const p2 = placedPagesOf(scene)[1]!;
    const first = renderHook(() => useSymmetry(scene, p2));
    const [group] = groups(scene);
    expect(group!.parent).toBe('p2');
    expect(p2.x).not.toBe(0);
    expect(symmetryOf(scene as never, group!.id)?.center).toEqual({ x: p2.x + 300, y: p2.y + 400 });
    // Stored in the page's frame.
    expect(scene.get(group!.id)!.pose).toMatchObject({ x: 300, y: 400 });
    first.unmount();
    const { result } = renderHook(() => useSymmetry(scene, p2));
    expect(groups(scene)).toHaveLength(1);
    expect(insertInto(result)).toBe(group!.id);
  });

  it('draws into a group on the new document after New replaces the pages, and into the old one again on undo', () => {
    act(() => drawPrefs().set('view.symmetry.on', true));
    const scene = newScene();
    createPageRun(scene, [{ id: 'page-1', ...PAGE }]);
    const { result } = renderHook(() => useSymmetry(scene, placedPagesOf(scene)[0]!));
    const [old] = groups(scene);
    act(() => scene.batch('New document', () => replacePages(scene, onePage(PAGE))));
    const [fresh] = groups(scene);
    expect(fresh).toBeDefined();
    expect(insertInto(result)).toBe(fresh!.id);
    act(() => { scene.undo(); });
    act(() => { scene.undo(); });
    expect(insertInto(result)).toBe(old!.id);
  });

  it('makes a fresh group when its group is deleted, and draws into the old one again when the delete is undone', () => {
    act(() => drawPrefs().set('view.symmetry.on', true));
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    const [old] = groups(scene);
    act(() => { scene.batch('Delete', () => { scene.remove(old!.id); }); });
    const [fresh] = groups(scene);
    expect(fresh).toBeDefined();
    expect(fresh!.id).not.toBe(old!.id);
    expect(insertInto(result)).toBe(fresh!.id);
    act(() => { scene.undo(); });
    act(() => { scene.undo(); });
    expect(insertInto(result)).toBe(old!.id);
  });

  it('waits while undo steps past its group\'s making, and draws into it again on redo', () => {
    act(() => drawPrefs().set('view.symmetry.on', true));
    const scene = newScene();
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    const [made] = groups(scene);
    act(() => { scene.undo(); });
    expect(groups(scene)).toHaveLength(0);
    expect(insertInto(result)).toBeNull();
    act(() => { scene.redo(); });
    expect(insertInto(result)).toBe(made!.id);
  });
  it('keeps a pending redo when it is turned on or mounted with no group, and makes one once the redo is gone', () => {
    const scene = newScene();
    const draw = () => act(() => { scene.batch('Draw', () => { scene.add(MARK as never); }); });
    draw();
    act(() => { scene.undo(); });
    for (const mount of ['toggle', 'remount'] as const) {
      act(() => drawPrefs().set('view.symmetry.on', mount === 'remount'));
      const { result, unmount } = renderHook(() => useSymmetry(scene, PAGE));
      if (mount === 'toggle') act(() => result.current.commands.toggleSymmetry());
      expect(groups(scene)).toHaveLength(0);
      expect(scene.canRedo()).toBe(true);
      expect(insertInto(result)).toBeNull();
      unmount();
    }
    const { result } = renderHook(() => useSymmetry(scene, PAGE));
    draw();
    expect(groups(scene)).toHaveLength(1);
    expect(insertInto(result)).toBe(groups(scene)[0]!.id);
  });
});
