import { describe, it, expect, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createWindow } from './window';
import { DEFAULT_WINDOW_METRICS as M } from './zones';

const ctx = {
  dims: { width: 800, height: 600 },
  defaultFont: 'D', toneAt: () => '#000000',
  tokens: resolveTheme(weaselTheme, { mode: 'dark' }),
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

  it('paints the resize bands, so the scene cannot show through the border', () => {
    const win = createWindow(opts);
    const filled = win.draw(ctx).filter(
      (c) => c.kind === 'path' && c.path.kind === 'rect' && c.fill !== undefined,
    ) as Array<{ path: { x: number; y: number; width: number; height: number } }>;
    const covered = (px: number, py: number) => filled.some(
      (c) => px >= c.path.x && px < c.path.x + c.path.width
        && py >= c.path.y && py < c.path.y + c.path.height,
    );
    const cr = win.contentRect;
    expect(covered(100 + M.edge / 2, cr.y + 10)).toBe(true);        // left band
    expect(covered(300 - M.edge / 2, cr.y + 10)).toBe(true);        // right band
    expect(covered(200, 250 - M.edge / 2)).toBe(true);              // bottom band
  });

  describe('stance and tone', () => {
    type Cmd = ReturnType<ReturnType<typeof createWindow>['draw']>[number];
    const bandColor = (cmds: Cmd[]) => {
      const c = cmds.find((c) => c.kind === 'path' && c.fill !== undefined) as { fill: { color: string } };
      return c.fill.color;
    };
    const ring = (cmds: Cmd[]) =>
      cmds.find((c) => c.kind === 'path' && c.stroke !== undefined && c.path.kind === 'rect') as
        | { stroke: { paint: { color: string }; width: number; dash?: number[] } }
        | undefined;
    const title = (cmds: Cmd[]) => JSON.stringify(cmds.find((c) => c.kind === 'text'));
    const rgb = (css: string) => css.match(/[\d.]+/g)!.slice(0, 3).map(Number);

    it('draws the base look with neither', () => {
      const cmds = createWindow(opts).draw(ctx);
      expect(bandColor(cmds)).toBe(ctx.tokens['--wzl-surface-raised']);
      expect(ring(cmds)?.stroke.paint.color).toBe(ctx.tokens['--wzl-border']);
    });

    it('takes the theme\'s stance slots, and mixes the stance\'s tone into the fill in oklab', () => {
      const cmds = createWindow({ ...opts, stance: 'danger' }).draw(ctx);
      expect(ring(cmds)?.stroke.paint.color).toBe(ctx.tokens['--wzl-stance-danger-border-color']);
      expect(title(cmds)).toContain(ctx.tokens['--wzl-stance-danger-title-color']);
      // Chrome's color-mix(in oklab, #d94a3f 14%, #25272c).
      expect(ctx.tokens['--wzl-surface-raised']).toBe('#25272c');
      rgb(bandColor(cmds)).forEach((v, i) => expect(Math.abs(v - [61, 46, 48][i])).toBeLessThanOrEqual(1));
    });

    it('drops the ring where a stance sets no border width, and dashes it where it says dashed', () => {
      expect(ring(createWindow({ ...opts, stance: 'scope' }).draw(ctx))).toBeUndefined();
      expect(ring(createWindow({ ...opts, stance: 'debug' }).draw(ctx))?.stroke.dash?.length).toBeGreaterThan(0);
    });

    it('resolves a numeric tone through the draw context, and takes a color as given', () => {
      const toneAt = vi.fn(() => '#d94a3f');
      const indexed = bandColor(createWindow({ ...opts, tone: 3 }).draw({ ...ctx, toneAt }));
      expect(toneAt).toHaveBeenCalledWith(3);
      expect(bandColor(createWindow({ ...opts, tone: '#d94a3f' }).draw(ctx))).toBe(indexed);
      expect(indexed).not.toBe(ctx.tokens['--wzl-surface-raised']);
    });

    it('redraws on setStance and setTone', () => {
      const onChange = vi.fn();
      const win = createWindow({ ...opts, onChange });
      win.setStance('danger');
      win.setTone(2);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(ring(win.draw(ctx))?.stroke.paint.color).toBe(ctx.tokens['--wzl-stance-danger-border-color']);
    });
  });

  describe('titlebar: false', () => {
    const bare = { ...opts, titlebar: false as const };

    it('draws no title and no close glyph', () => {
      const cmds = createWindow(bare).draw(ctx);
      expect(cmds.some((c) => c.kind === 'text')).toBe(false);
      expect(cmds.some((c) => c.kind === 'path' && c.path.kind === 'polygon')).toBe(false);
    });

    it('insets the content by the resize band on all four sides', () => {
      const cr = createWindow(bare).contentRect;
      expect(cr).toEqual({
        x: 100 + M.edge, y: 100 + M.edge,
        w: 200 - M.edge * 2, h: 150 - M.edge * 2,
      });
    });

    it('moves when the interior is dragged, since there is no bar to grab', () => {
      const onMove = vi.fn();
      const win = createWindow({ ...bare, onMove });
      win.onPointer({ type: 'down', x: 200, y: 175, native: null });
      win.onPointer({ type: 'move', x: 230, y: 195, native: null });
      expect(win.bounds).toMatchObject({ x: 130, y: 120, w: 200, h: 150 });
      expect(onMove).toHaveBeenCalled();
    });

    it('still resizes from the edges', () => {
      const win = createWindow(bare);
      win.onPointer({ type: 'down', x: 299, y: 175, native: null });
      win.onPointer({ type: 'move', x: 329, y: 175, native: null });
      expect(win.bounds).toMatchObject({ w: 230 });
    });
  });

  it('hitTest covers the whole window including the interior', () => {
    const win = createWindow(opts);
    expect(win.hitTest(200, 200)).toBe(true);
    expect(win.hitTest(99, 100)).toBe(false);
  });

  it('takes the default claim set, so no press falls through to the scene', () => {
    const win = createWindow(opts);
    expect(win.claims).toBeUndefined();
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

  it('a press and release in the interior fires onContentClick', () => {
    const onContentClick = vi.fn();
    const win = createWindow({ ...opts, onContentClick });
    win.onPointer({ type: 'down', x: 200, y: 175, native: null });
    win.onPointer({ type: 'up', x: 200, y: 175, native: null });
    expect(onContentClick).toHaveBeenCalledWith({ x: 200, y: 175 });
  });

  it('a press that became a drag does not fire onContentClick', () => {
    const onContentClick = vi.fn();
    const win = createWindow({ ...opts, titlebar: false as const, onContentClick });
    win.onPointer({ type: 'down', x: 200, y: 175, native: null });
    win.onPointer({ type: 'move', x: 240, y: 175, native: null });
    win.onPointer({ type: 'up', x: 240, y: 175, native: null });
    expect(onContentClick).not.toHaveBeenCalled();
    expect(win.bounds).toMatchObject({ x: 140 });
  });

  it('a press that only jittered still fires onContentClick', () => {
    const onContentClick = vi.fn();
    const win = createWindow({ ...opts, titlebar: false as const, onContentClick });
    win.onPointer({ type: 'down', x: 200, y: 175, native: null });
    win.onPointer({ type: 'move', x: 201, y: 176, native: null });
    win.onPointer({ type: 'up', x: 201, y: 176, native: null });
    expect(onContentClick).toHaveBeenCalledTimes(1);
  });

  it('presses outside the interior do not fire onContentClick', () => {
    const onContentClick = vi.fn();
    const win = createWindow({ ...opts, onContentClick });
    const bar = { x: 150, y: 100 + M.titleH / 2 };
    win.onPointer({ type: 'down', ...bar, native: null });
    win.onPointer({ type: 'up', ...bar, native: null });
    win.onPointer({ type: 'down', x: 299, y: 175, native: null });
    win.onPointer({ type: 'up', x: 299, y: 175, native: null });
    expect(onContentClick).not.toHaveBeenCalled();
  });

  it('contentRect tracks a resize', () => {
    const win = createWindow(opts);
    win.onPointer({ type: 'down', x: 299, y: 175, native: null });
    win.onPointer({ type: 'move', x: 329, y: 175, native: null });
    expect(win.contentRect.w).toBe(230 - M.edge * 2);
  });

  it('setBounds mid-drag ends the drag rather than rebasing from a stale origin', () => {
    const win = createWindow(opts);
    win.onPointer({ type: 'down', x: 150, y: 100 + M.titleH / 2, native: null });
    win.setBounds({ x: 400, y: 400, w: 200, h: 150 });
    win.onPointer({ type: 'move', x: 250, y: 200, native: null });
    expect(win.bounds).toMatchObject({ x: 400, y: 400 });
  });

  it('setBounds clamps to the minimum size', () => {
    const win = createWindow({ ...opts, minW: 80, minH: 60 });
    win.setBounds({ x: 0, y: 0, w: 10, h: 10 });
    expect(win.bounds).toMatchObject({ w: 80, h: 60 });
  });
});

describe('window widget stays on the host', () => {
  const drawn = () => {
    const win = createWindow(opts);
    win.draw(ctx);
    return win;
  };
  const grabTitle = (win: ReturnType<typeof createWindow>) =>
    win.onPointer({ type: 'down', x: 150, y: 100 + M.titleH / 2, native: null });

  it('a move drag cannot push the window past the far edges', () => {
    const win = drawn();
    grabTitle(win);
    win.onPointer({ type: 'move', x: 5000, y: 5000, native: null });
    expect(win.bounds.x).toBe(600);
    expect(win.bounds.y).toBe(450);
  });

  it('a move drag cannot push the window past the near edges', () => {
    const win = drawn();
    grabTitle(win);
    win.onPointer({ type: 'move', x: -5000, y: -5000, native: null });
    expect(win.bounds.x).toBe(0);
    expect(win.bounds.y).toBe(0);
  });

  it('setBounds lands the window on the host', () => {
    const win = drawn();
    win.setBounds({ x: 5000, y: 5000, w: 200, h: 150 });
    expect(win.bounds).toEqual({ x: 600, y: 450, w: 200, h: 150 });
  });

  it('leaves position alone until a draw has reported the host size', () => {
    const win = createWindow(opts);
    win.setBounds({ x: 5000, y: 5000, w: 200, h: 150 });
    expect(win.bounds.x).toBe(5000);
  });

  it('does not fight a resize drag that crosses the host edge', () => {
    const win = drawn();
    win.onPointer({ type: 'down', x: 299, y: 175, native: null });
    win.onPointer({ type: 'move', x: 900, y: 175, native: null });
    expect(win.bounds.x).toBe(100);
    expect(win.bounds.w).toBeGreaterThan(200);
  });
});

describe('window interior', () => {
  const at = (win: ReturnType<typeof createWindow>) => {
    const cr = win.contentRect;
    return { x: cr.x + cr.w / 2, y: cr.y + cr.h / 2 };
  };

  it('claims its interior by default', () => {
    const win = createWindow(opts);
    const p = at(win);
    expect(win.hitTest(p.x, p.y)).toBe(true);
    expect(win.passes?.(p.x, p.y)).toBe(false);
  });

  it('passes its interior on when asked, and keeps its frame', () => {
    const win = createWindow({ ...opts, interior: 'pass' });
    const p = at(win);
    expect(win.hitTest(p.x, p.y)).toBe(false);
    expect(win.passes?.(p.x, p.y)).toBe(true);
    expect(win.hitTest(150, 100 + M.titleH / 2)).toBe(true);
    expect(win.passes?.(150, 100 + M.titleH / 2)).toBe(false);
  });

  it('a bare passing interior is not a move handle', () => {
    const win = createWindow({ ...opts, titlebar: false, interior: 'pass' });
    const p = at(win);
    win.onPointer({ type: 'down', x: p.x, y: p.y, native: null });
    win.onPointer({ type: 'move', x: p.x + 30, y: p.y, native: null });
    expect(win.bounds.x).toBe(opts.x);
  });

  it('a hidden window passes nothing', () => {
    const win = createWindow({ ...opts, interior: 'pass' });
    win.setHidden(true);
    const p = at(win);
    expect(win.passes?.(p.x, p.y)).toBe(false);
  });
});
