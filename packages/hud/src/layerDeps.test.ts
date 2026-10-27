import { describe, it, expect } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createHud } from './hud';
import { createLayerDeps } from './layerDeps';
import type { HudDrawCtx, Widget } from './widget';

const tokens = resolveTheme(weaselTheme);
const ctx = (width = 400, height = 300): HudDrawCtx =>
  ({ dims: { width, height }, defaultFont: 'sans-serif', tokens, color: () => undefined });

function plain(extra: Partial<Widget> = {}): Widget {
  return {
    id: 'plain', bounds: { x: 0, y: 0, w: 10, h: 10 }, hidden: false,
    draw: () => [], hitTest: () => false, onPointer: () => {},
    ...extra,
  };
}

function setup() {
  const hud = createHud();
  const deps = createLayerDeps(hud);
  return { hud, deps };
}

describe('the HUD layer\'s deps', () => {
  it('hold across frames while nothing changes', () => {
    const { hud, deps } = setup();
    hud.text({ id: 'a', x: 0, y: 0, text: 'one', fontSize: 14 });
    const first = deps(ctx());
    expect(deps(ctx())).toBe(first);
    expect(deps(ctx())).toBe(first);
  });

  it('move on the frame anything a widget draws from changes, then hold again', () => {
    const { hud, deps } = setup();
    const label = hud.text({ id: 'a', x: 0, y: 0, text: 'one', fontSize: 14 });
    const changes: Array<() => void> = [
      () => label.setText('two'),
      () => label.setBounds({ x: 5, y: 0, w: 0, h: 14 }),
      () => label.setHidden(true),
      () => label.setHidden(false),
      () => hud.text({ id: 'b', x: 0, y: 20, text: 'more', fontSize: 14 }),
    ];
    let last = deps(ctx());
    for (const change of changes) {
      change();
      const next = deps(ctx());
      expect(next).not.toBe(last);
      expect(deps(ctx())).toBe(next);
      last = next;
    }
    expect(deps(ctx(800, 300))).not.toBe(last);
  });

  it('move when focus or its ring changes', () => {
    const { hud, deps } = setup();
    const w = plain({ focusable: true, deps: () => [1] });
    hud.add(w);
    const before = deps(ctx());
    hud.focus(w);
    const focused = deps(ctx());
    expect(focused).not.toBe(before);
    hud.focus(w, { visible: true });
    expect(deps(ctx())).not.toBe(focused);
  });

  it('follow a hand-written widget\'s own deps by value', () => {
    const { hud, deps } = setup();
    let value = 1;
    hud.add(plain({ deps: () => [value] }));
    const first = deps(ctx());
    expect(deps(ctx())).toBe(first);
    value = 2;
    expect(deps(ctx())).not.toBe(first);
  });

  it('move every frame while a showing widget declares no deps or paints content', () => {
    for (const extra of [{}, { deps: () => [1], content: () => [], contentRect: { x: 0, y: 0, w: 5, h: 5 } }]) {
      const { hud, deps } = setup();
      const w = plain(extra);
      hud.add(w);
      const first = deps(ctx());
      expect(deps(ctx())).not.toBe(first);
      (w as { hidden: boolean }).hidden = true;
      const hidden = deps(ctx());
      expect(deps(ctx())).toBe(hidden);
    }
  });
});
