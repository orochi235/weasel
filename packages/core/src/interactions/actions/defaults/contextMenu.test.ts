import { describe, expect, it, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import { keyboardAnchor, menuHitFor, openContextMenu } from './contextMenu';

function deps(over: Record<string, unknown> = {}) {
  const selected: string[] = ['a'];
  return {
    menuHost: { open: vi.fn(() => true) },
    selection: { get: () => selected, set: vi.fn((ids: string[]) => { selected.splice(0, selected.length, ...ids); }) },
    hitAt: vi.fn(() => ({ bodyTarget: 'unselected-body', bodyKind: 'rect', id: 'b' })),
    kindOfNode: (id: string) => (id === 'a' ? 'text' : 'rect'),
    worldToClient: (x: number, y: number) => ({ x: x + 1000, y: y + 1000 }),
    scene: { get: (id: string) => ({ id, kind: id === 'a' ? 'text' : 'rect' }) },
    ...over,
  } as never;
}

describe('openContextMenu', () => {
  it('selects an unselected body first, then opens for the hit', () => {
    const d = deps() as { menuHost: { open: ReturnType<typeof vi.fn> }; selection: { set: ReturnType<typeof vi.fn> } };
    openContextMenu(d as never, { worldX: 5, worldY: 6, clientX: 50, clientY: 60 });
    expect(d.selection.set).toHaveBeenCalledWith(['b']);
    expect(d.menuHost.open).toHaveBeenCalledWith({
      hit: { bodyTarget: 'selected-body', bodyKind: 'rect' },
      client: { x: 50, y: 60 }, world: { x: 5, y: 6 }, source: 'pointer',
    });
  });
  it('leaves the selection alone on empty canvas', () => {
    const d = deps() as { selection: { set: ReturnType<typeof vi.fn> } };
    (d as unknown as { hitAt: ReturnType<typeof vi.fn> }).hitAt.mockReturnValue({ bodyTarget: 'empty' });
    openContextMenu(d as never, { worldX: 5, worldY: 6, clientX: 50, clientY: 60 });
    expect(d.selection.set).not.toHaveBeenCalled();
  });
  it('opens from the keyboard at the selection, highlighted', () => {
    const d = deps() as { menuHost: { open: ReturnType<typeof vi.fn> } };
    const centerOf = vi.fn(() => ({ x: 10, y: 20 }));
    openContextMenu(d as never, undefined, centerOf);
    expect(d.menuHost.open).toHaveBeenCalledWith(expect.objectContaining({
      hit: { bodyTarget: 'selected-body', bodyKind: 'text' },
      client: { x: 1010, y: 1020 }, world: { x: 10, y: 20 }, source: 'keyboard',
    }));
  });
  it('does nothing without a menu host', () => {
    expect(openContextMenu(deps({ menuHost: undefined }) as never, { worldX: 0, worldY: 0, clientX: 0, clientY: 0 })).toBe(false);
  });

});

describe('keyboardAnchor', () => {
  it('is the center of the selection bounds', () => {
    const scene = createScene<unknown, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'mark', data: {}, layer: 'main', pose: { x: 10, y: 20, width: 100, height: 40 } });
    expect(keyboardAnchor({ scene, selection: { get: () => [id] } } as never)).toEqual({ x: 60, y: 40 });
  });
  it('is the center of the view with nothing selected', () => {
    const view = { get: () => ({ x: 100, y: 50, scale: { x: 2, y: 2 } }), hostSize: () => ({ width: 400, height: 200 }) };
    expect(keyboardAnchor({ selection: { get: () => [] }, view } as never)).toEqual({ x: 200, y: 100 });
  });
});

describe('menuHitFor', () => {
  it('names no body for a pointer hit when no classifier is wired', () => {
    expect(menuHitFor({ selection: { get: () => ['a'] } } as never, { x: 1, y: 2 })).toEqual({ hit: {} });
  });
  it('names the classified node to select when it is not yet selected', () => {
    const hitAt = () => ({ bodyTarget: 'unselected-body', bodyKind: 'rect', id: 'b' });
    expect(menuHitFor({ hitAt } as never, { x: 1, y: 2 })).toEqual({
      hit: { bodyTarget: 'selected-body', bodyKind: 'rect' }, select: 'b',
    });
  });
});
