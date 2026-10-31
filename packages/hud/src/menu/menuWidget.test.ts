import { describe, expect, it, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import type { OpenMenu } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { MenuEntry } from '@weasel-js/menu';
import { createMenuWidget } from './menuWidget';
import type { HudDrawCtx, HudKeyEvent } from '../widget';

const run = vi.fn();
const entries: MenuEntry[] = [
  { kind: 'item', key: 'cut', label: 'Cut', run },
  { kind: 'separator', key: 's' },
  { kind: 'item', key: 'del', label: 'Delete', run, disabled: true },
];
const open: OpenMenu = { seq: 1, source: 'pointer', client: { x: 100, y: 100 }, entries };
const ctx = {
  dims: { width: 800, height: 600 }, defaultFont: 'Inter',
  tokens: { '--wzl-surface-popover': '#222', '--wzl-surface-hover': '#333', '--wzl-fg': '#eee', '--wzl-fg-muted': '#888', '--wzl-border': '#444', '--wzl-shadow': '#0008' },
  color: () => undefined,
} as never as HudDrawCtx;

function widget(menu: OpenMenu = open) {
  const close = vi.fn();
  const w = createMenuWidget({
    open: menu, close, toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }),
    measure: (t) => t.length * 7, onChange: () => {},
  });
  return { w, close };
}

function keydown(key: string, mods: Partial<HudKeyEvent> = {}): HudKeyEvent {
  return {
    type: 'keydown', key, code: key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    repeat: false, native: null, ...mods,
  };
}

/** Every `color` string anywhere in the commands. */
function colors(cmds: readonly DrawCommand[]): unknown[] {
  const out: unknown[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'color') out.push(x); else walk(x);
      }
    }
  };
  walk(cmds);
  return out;
}

describe('createMenuWidget links', () => {
  it('runs an href row, then navigates to it', () => {
    window.location.hash = '';
    const ran = vi.fn();
    const link: MenuEntry = { kind: 'item', key: 'docs', label: 'Docs', href: '#docs', run: ran };
    const { w, close } = widget({ ...open, source: 'keyboard', entries: [link] });
    w.onKey!(keydown('Enter'));
    expect(ran).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#docs');
    expect(close).toHaveBeenCalled();
    window.location.hash = '';
  });
});

describe('createMenuWidget', () => {
  it('places its panel at the open point and claims every gesture', () => {
    const { w } = widget();
    expect(w.bounds).toMatchObject({ x: 100, y: 100, w: 180 });
    expect(w.claims).toEqual(['pointer', 'doubleClick', 'contextMenu', 'longPress', 'wheel']);
    expect(w.focusable).toBe(true);
    expect(w.accessibleName).toBe('Context menu');
  });

  it('draws a panel, one row of text per item, and a separator rule', () => {
    const { w } = widget();
    const cmds = w.draw(ctx);
    expect(cmds.filter((c) => c.kind === 'text')).toHaveLength(2);
    expect(cmds.filter((c) => c.kind === 'path')).toHaveLength(2);
  });

  it('draws a highlight behind the hovered row', () => {
    const { w } = widget();
    const before = w.draw(ctx).length;
    w.onPointer({ type: 'hovermove', x: 110, y: 110, native: null });
    expect(w.draw(ctx).length).toBe(before + 1);
  });

  it('runs a pressed item through the controller', () => {
    run.mockClear();
    const { w, close } = widget();
    w.onPointer({ type: 'down', x: 110, y: 110, native: null });
    w.onPointer({ type: 'up', x: 110, y: 110, native: null });
    expect(close).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });

  it('ignores a release with no press on it, as when the opening right-click lets go', () => {
    run.mockClear();
    const { w, close } = widget();
    w.onPointer({ type: 'up', x: 110, y: 110, native: null });
    expect(run).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('routes keys to the controller', () => {
    const { w, close } = widget();
    expect(w.onKey!(keydown('Escape'))).toBe(true);
    expect(close).toHaveBeenCalled();
  });

  it('swallows a key held with Ctrl, Meta or Alt without acting on it', () => {
    const { w, close } = widget();
    for (const mods of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(w.onKey!(keydown('Escape', mods))).toBe(true);
    }
    expect(close).not.toHaveBeenCalled();
    expect(w.onKey!({ ...keydown('Escape'), type: 'keyup' })).toBe(false);
  });

  it('opens a submenu beside its row and runs an item in it', () => {
    const inner = vi.fn();
    const { w, close } = widget({
      ...open,
      entries: [
        { kind: 'submenu', key: 'more', label: 'More', entries: [{ kind: 'item', key: 'x', label: 'Inner', run: inner }] },
      ],
    });
    w.onPointer({ type: 'down', x: 110, y: 110, native: null });
    w.onPointer({ type: 'up', x: 110, y: 110, native: null });
    expect(w.bounds).toMatchObject({ x: 100, y: 100, w: 360 });
    const backgrounds = w.draw(ctx).filter((c) => c.kind === 'path' && c.fill && c.stroke);
    expect(backgrounds).toHaveLength(2);
    w.onPointer({ type: 'down', x: 290, y: 110, native: null });
    w.onPointer({ type: 'up', x: 290, y: 110, native: null });
    expect(inner).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('describes itself as a menu tree: roles, states, and the open submenu under its row', () => {
    const { w } = widget({
      ...open, source: 'keyboard',
      entries: [
        { kind: 'item', key: 'grid', label: 'Grid', checked: true, run },
        { kind: 'separator', key: 's' },
        { kind: 'submenu', key: 'more', label: 'More', entries: [{ kind: 'item', key: 'x', label: 'Inner', run, disabled: true }] },
      ],
    });
    const tree = () => w.accessibleTree!.read();
    expect(tree().children!.map((n) => [n.role, n.active ?? false])).toEqual([
      ['menuitemcheckbox', true], ['separator', false], ['menuitem', false],
    ]);
    expect(tree().children![0]!.checked).toBe(true);
    w.onKey!(keydown('ArrowUp'));
    w.onKey!(keydown('ArrowRight'));
    const more = tree().children![2]!;
    expect(more.expanded).toBe(true);
    expect(more.active).toBeUndefined();
    expect(more.children![0]!.children![0]).toMatchObject({ role: 'menuitem', label: 'Inner', disabled: true, active: true });
  });

  it('describes a radio row as a menuitemradio', () => {
    const { w } = widget({
      ...open, source: 'keyboard',
      entries: [{ kind: 'item', key: 'a', label: 'A', checked: false, radio: true, run }],
    });
    expect(w.accessibleTree!.read().children![0]).toMatchObject({ role: 'menuitemradio', checked: false });
  });

  it('draws every color from a real theme as a concrete value', () => {
    const { w } = widget();
    w.onPointer({ type: 'hovermove', x: 110, y: 110, native: null });
    const themed = { ...ctx, tokens: resolveTheme(weaselTheme) };
    const found = colors(w.draw(themed));
    expect(found.length).toBeGreaterThan(0);
    for (const c of found) {
      expect(typeof c).toBe('string');
      expect(c).not.toMatch(/currentcolor|var\(/i);
    }
  });

  it('asks the hud not to ring it', () => {
    expect(widget().w.focusRing).toBe(false);
  });

  it('clears a submenu row when the pointer moves back onto its parent', () => {
    const { w } = widget({
      ...open,
      entries: [
        { kind: 'submenu', key: 'more', label: 'More', entries: [{ kind: 'item', key: 'x', label: 'Inner', run }] },
      ],
    });
    const highlights = () => w.draw(ctx).filter((c) => c.kind === 'path' && c.fill?.paint?.kind === 'solid'
      && c.fill.paint.color === '#333').length;
    w.onPointer({ type: 'down', x: 110, y: 110, native: null });
    w.onPointer({ type: 'up', x: 110, y: 110, native: null });
    w.onPointer({ type: 'hovermove', x: 290, y: 110, native: null });
    expect(highlights()).toBe(2);
    w.onPointer({ type: 'hovermove', x: 110, y: 110, native: null });
    expect(highlights()).toBe(1);
  });

  it('measures each level once, not on every highlight change', () => {
    const measure = vi.fn((t: string) => t.length * 7);
    const w = createMenuWidget({
      open: {
        ...open,
        entries: [
          { kind: 'submenu', key: 'more', label: 'More', entries: [
            { kind: 'item', key: 'x', label: 'Inner', run },
            { kind: 'item', key: 'y', label: 'Other', run },
          ] },
          { kind: 'item', key: 'cut', label: 'Cut', run },
        ],
      },
      close: () => {}, toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }), measure, onChange: () => {},
    });
    w.draw(ctx);
    const root = measure.mock.calls.length;
    w.onPointer({ type: 'hovermove', x: 110, y: 110 + 24, native: null });
    w.onPointer({ type: 'hovermove', x: 110, y: 110, native: null });
    w.draw(ctx);
    expect(measure.mock.calls.length).toBe(root);
    w.onPointer({ type: 'down', x: 110, y: 110, native: null });
    w.onPointer({ type: 'up', x: 110, y: 110, native: null });
    const opened = measure.mock.calls.length;
    expect(opened).toBeGreaterThan(root);
    w.onPointer({ type: 'hovermove', x: 290, y: 110, native: null });
    w.onPointer({ type: 'hovermove', x: 290, y: 110 + 24, native: null });
    w.draw(ctx);
    expect(measure.mock.calls.length).toBe(opened);
  });

  it('stops answering once disposed', () => {
    const { w, close } = widget();
    w.dispose();
    expect(w.disposed).toBe(true);
    w.onKey!(keydown('Escape'));
    expect(close).not.toHaveBeenCalled();
  });
});
