import { describe, expect, it, vi } from 'vitest';
import { openContextMenu } from './contextMenu';

function deps(over: Record<string, unknown> = {}) {
  const selected: string[] = ['a'];
  return {
    menuHost: { open: vi.fn(() => true) },
    selection: { get: () => selected, set: vi.fn((ids: string[]) => { selected.splice(0, selected.length, ...ids); }) },
    nodeAtPoint: vi.fn(() => 'b'),
    worldToClient: (x: number, y: number) => ({ x: x + 1000, y: y + 1000 }),
    scene: { get: (id: string) => ({ id, kind: id === 'a' ? 'text' : 'rect' }) },
    ...over,
  } as never;
}

describe('openContextMenu', () => {
  it('selects an unselected body first, then opens for the hit', () => {
    const d = deps() as { menuHost: { open: ReturnType<typeof vi.fn> }; selection: { set: ReturnType<typeof vi.fn> } };
    openContextMenu(d as never, { worldX: 5, worldY: 6, clientX: 50, clientY: 60, bodyTarget: 'unselected-body', bodyKind: 'rect' });
    expect(d.selection.set).toHaveBeenCalledWith(['b']);
    expect(d.menuHost.open).toHaveBeenCalledWith({
      hit: { bodyTarget: 'selected-body', bodyKind: 'rect' },
      client: { x: 50, y: 60 }, world: { x: 5, y: 6 }, source: 'pointer',
    });
  });
  it('leaves the selection alone on empty canvas', () => {
    const d = deps() as { selection: { set: ReturnType<typeof vi.fn> } };
    openContextMenu(d as never, { worldX: 5, worldY: 6, clientX: 50, clientY: 60, bodyTarget: 'empty' });
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
