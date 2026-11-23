import { describe, expect, it } from 'vitest';
import type { LoupeAimMode } from '@weasel-js/loupe';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createWindow } from '../widgets/window/window';
import { createPinHandle } from './pinHandle';
import { pinDockIn } from './rimTracks';

const B = { x: 0, y: 0, width: 200, height: 200 };
const at = (type: 'down' | 'move' | 'up', x: number, y: number) => ({ type, x, y, native: null });
const ctx = {
  dims: { width: 800, height: 600 }, defaultFont: 'sans-serif',
  tokens: resolveTheme(weaselTheme, { mode: 'light' }), color: () => undefined,
};

/** A pin over a lens whose aim is plain state: pinning sets it, following leaves it. */
function setup(shown = true) {
  const win = createWindow({ id: 'w', title: 'Loupe', shape: 'round', ...B });
  const lens = { mode: 'follow' as LoupeAimMode, aim: { x: 0, y: 0 } };
  const pin = createPinHandle('p', {
    win, round: true, shown: () => shown,
    aimMode: () => lens.mode, aim: () => lens.aim,
    pinAt: (p) => { lens.mode = 'pinned'; lens.aim = p; },
    setAimMode: (m) => { lens.mode = m; },
  });
  return { pin, lens, dock: pinDockIn(win.bounds, true) };
}

const dashedPaths = (cmds: DrawCommand[]) =>
  cmds.filter((c): c is PathDrawCommand => c.kind === 'path' && c.stroke?.dash !== undefined);

describe('the loupe pin', () => {
  it('docks on the ring past the mode switch, right of the lens', () => {
    const { dock } = setup();
    expect(Math.hypot(dock.x - 100, dock.y - 100)).toBeGreaterThan(100);
    expect(dock.x).toBeGreaterThan(200);
  });

  it('pins where it is dragged and dropped, following the drag on the way', () => {
    const { pin, lens, dock } = setup();
    expect(pin.hitTest(dock.x, dock.y)).toBe(true);
    pin.onPointer(at('down', dock.x, dock.y));
    pin.onPointer(at('move', 400, 300));
    expect(lens).toEqual({ mode: 'pinned', aim: { x: 400, y: 300 } });
    pin.onPointer(at('move', 500, 350));
    pin.onPointer(at('up', 500, 350));
    expect(lens).toEqual({ mode: 'pinned', aim: { x: 500, y: 350 } });
  });

  it('draws its target as an open dashed circle, joined to the pin by a dashed line, while the ring shows', () => {
    const { pin, dock } = setup();
    pin.onPointer(at('down', dock.x, dock.y));
    pin.onPointer(at('move', 500, 350));
    pin.onPointer(at('up', 500, 350));
    const dashed = dashedPaths(pin.draw(ctx));
    expect(dashed).toHaveLength(2);
    expect(dashed.every((c) => c.fill === undefined)).toBe(true);
  });

  it('draws nothing at rest while the ring is hidden, the target included', () => {
    const { pin, lens } = setup(false);
    lens.mode = 'pinned';
    lens.aim = { x: 500, y: 350 };
    expect(pin.draw(ctx)).toEqual([]);
    expect(pin.hitTest(500, 350)).toBe(false);
  });

  it('moves the pin by its target, and takes it back when dropped on the lens', () => {
    const { pin, lens, dock } = setup();
    pin.onPointer(at('down', dock.x, dock.y));
    pin.onPointer(at('move', 500, 350));
    pin.onPointer(at('up', 500, 350));
    pin.onPointer(at('down', 500, 350));
    pin.onPointer(at('move', 520, 360));
    pin.onPointer(at('up', 520, 360));
    expect(lens.aim).toEqual({ x: 520, y: 360 });
    pin.onPointer(at('down', 520, 360));
    pin.onPointer(at('move', 100, 100));
    pin.onPointer(at('up', 100, 100));
    expect(lens.mode).toBe('follow');
  });

  it('toggles on a click: pins where the lens aims, and lets go again', () => {
    const { pin, lens, dock } = setup();
    pin.onPointer(at('down', dock.x, dock.y));
    pin.onPointer(at('up', dock.x, dock.y));
    expect(lens.mode).toBe('pinned');
    pin.onPointer(at('down', dock.x, dock.y));
    pin.onPointer(at('up', dock.x, dock.y));
    expect(lens.mode).toBe('follow');
  });

  it('puts the lens back as it was when the drag is canceled', () => {
    const { pin, lens, dock } = setup();
    pin.onPointer(at('down', dock.x, dock.y));
    pin.onPointer(at('move', 400, 300));
    pin.onPointer({ type: 'cancel', native: null });
    expect(lens.mode).toBe('follow');
  });

  it('keeps carrying the pin through a long press, a double click, or a context menu', () => {
    const { pin, lens, dock } = setup();
    pin.onPointer(at('down', dock.x, dock.y));
    for (const type of ['longpress', 'doubleclick', 'contextmenu'] as const) pin.onPointer({ type, x: dock.x, y: dock.y, native: null });
    pin.onPointer(at('move', 400, 300));
    expect(lens).toEqual({ mode: 'pinned', aim: { x: 400, y: 300 } });
    pin.onPointer(at('move', 100, 100));
    pin.onPointer(at('up', 100, 100));
    expect(lens.mode).toBe('follow');
  });
});
