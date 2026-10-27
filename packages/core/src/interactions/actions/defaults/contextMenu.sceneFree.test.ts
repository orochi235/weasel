import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, contextMenuAction, openContextMenu } from '@weasel-js/core';

function deps(matches = true) {
  return {
    menuHost: { open: vi.fn(() => true), has: vi.fn(() => matches) },
    view: {
      get: () => ({ x: 100, y: 50, scale: { x: 2, y: 2 } }),
      set: () => {},
      hostSize: () => ({ width: 400, height: 200 }),
    },
    worldToClient: (x: number, y: number) => ({ x: x + 1000, y: y + 1000 }),
  };
}

describe('menu.context with only menuHost, view and worldToClient', () => {
  it('opens at a right-click, for the event’s world point', () => {
    const d = deps();
    openContextMenu(d as never, { clientX: 50, clientY: 60, world: { x: 5, y: 6 } });
    expect(d.menuHost.open).toHaveBeenCalledWith({
      hit: {}, client: { x: 50, y: 60 }, world: { x: 5, y: 6 }, source: 'pointer',
    });
  });

  it('opens from the keyboard at the middle of the view', () => {
    const d = deps();
    expect(openContextMenu(d as never)).toBe(true);
    expect(d.menuHost.open).toHaveBeenCalledWith({
      hit: {},
      client: { x: 1200, y: 1100 }, world: { x: 200, y: 100 }, source: 'keyboard',
    });
  });

  it('is not applicable when the host has no matching menu', () => {
    expect(contextMenuAction.enabled?.(deps(false) as never, { x: 5, y: 6 })).toBe(ActionDisabledReason.NotApplicable);
    expect(contextMenuAction.enabled?.(deps(true) as never, { x: 5, y: 6 })).toBe(true);
  });
});
