import { describe, it, expect, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createWindow } from './window';
import { DEFAULT_WINDOW_METRICS as M } from './zones';

const ctx = {
  dims: { width: 800, height: 600 },
  defaultFont: 'D',
  tokens: resolveTheme(weaselTheme, 'dark'),
};

const opts = { id: 'w', x: 100, y: 100, w: 200, h: 150, title: 'Loupe' };

describe('window widget', () => {
  it('draws a titlebar, a border ring, a title and a close glyph', () => {
    const win = createWindow(opts);
    const cmds = win.draw(ctx);
    expect(cmds.filter((c) => c.kind === 'path').length).toBeGreaterThanOrEqual(3);
    expect(cmds.some((c) => c.kind === 'text')).toBe(true);
  });

  it('does not fill the interior — the content hole stays open', () => {
    const win = createWindow(opts);
    const filledRects = win.draw(ctx).filter(
      (c) => c.kind === 'path' && c.path.kind === 'rect' && c.fill !== undefined,
    );
    const cr = win.contentRect;
    const cx = cr.x + cr.w / 2, cy = cr.y + cr.h / 2;
    const covers = filledRects.some((c) => {
      const p = (c as { path: { x: number; y: number; width: number; height: number } }).path;
      return cx >= p.x && cx < p.x + p.width && cy >= p.y && cy < p.y + p.height;
    });
    expect(covers).toBe(false);
  });

  it('hitTest covers the whole window including the interior', () => {
    const win = createWindow(opts);
    expect(win.hitTest(200, 200)).toBe(true);
    expect(win.hitTest(99, 100)).toBe(false);
  });

  it('claims every press so nothing falls through to the scene', () => {
    const win = createWindow(opts);
    expect(win.onPointer({ type: 'down', x: 200, y: 200, native: null })).toBe('claim');
  });

  it('drags the titlebar to move, and reports via onMove', () => {
    const onMove = vi.fn();
    const win = createWindow({ ...opts, onMove });
    win.onPointer({ type: 'down', x: 150, y: 100 + M.titleH / 2, native: null });
    win.onPointer({ type: 'move', x: 170, y: 100 + M.titleH / 2 + 10, native: null });
    expect(win.bounds).toMatchObject({ x: 120, y: 110, w: 200, h: 150 });
    expect(onMove).toHaveBeenCalled();
  });

  it('drags the east edge to resize, and reports via onResize', () => {
    const onResize = vi.fn();
    const win = createWindow({ ...opts, onResize });
    win.onPointer({ type: 'down', x: 299, y: 175, native: null });
    win.onPointer({ type: 'move', x: 329, y: 175, native: null });
    expect(win.bounds).toMatchObject({ x: 100, y: 100, w: 230, h: 150 });
    expect(onResize).toHaveBeenCalled();
  });

  it('cancel restores the bounds the drag started from', () => {
    const win = createWindow(opts);
    win.onPointer({ type: 'down', x: 150, y: 100 + M.titleH / 2, native: null });
    win.onPointer({ type: 'move', x: 250, y: 300, native: null });
    win.onPointer({ type: 'cancel', native: null });
    expect(win.bounds).toMatchObject({ x: 100, y: 100, w: 200, h: 150 });
  });

  it('a press-and-release on the close box fires onClose; a drag off it does not', () => {
    const onClose = vi.fn();
    const win = createWindow({ ...opts, onClose });
    const cx = 300 - M.edge - M.closeSize / 2, cy = 100 + M.titleH / 2;
    win.onPointer({ type: 'down', x: cx, y: cy, native: null });
    win.onPointer({ type: 'up', x: cx, y: cy, native: null });
    expect(onClose).toHaveBeenCalledTimes(1);

    win.onPointer({ type: 'down', x: cx, y: cy, native: null });
    win.onPointer({ type: 'up', x: 150, y: 200, native: null });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('contentRect tracks a resize', () => {
    const win = createWindow(opts);
    win.onPointer({ type: 'down', x: 299, y: 175, native: null });
    win.onPointer({ type: 'move', x: 329, y: 175, native: null });
    expect(win.contentRect.w).toBe(230 - M.edge * 2);
  });

  it('setBounds clamps to the minimum size', () => {
    const win = createWindow({ ...opts, minW: 80, minH: 60 });
    win.setBounds({ x: 0, y: 0, w: 10, h: 10 });
    expect(win.bounds).toMatchObject({ w: 80, h: 60 });
  });
});
