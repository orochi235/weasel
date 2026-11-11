/** Counterexamples `attachMenuHost.pbt.test.ts` found, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { createMenuHost } from '@weasel-js/routing';
import { createHud } from '../hud';
import type { Widget } from '../widget';
import { attachMenuHost } from './attachMenuHost';

const opts = { toCanvas: (p: { x: number; y: number }) => p, canvasSize: () => ({ width: 800, height: 600 }), measure: () => 40 };

describe('attachMenuHost, shrunk', () => {
  it('gives focus back when detached while its menu is open, so a close after reattaching gives it back too', () => {
    const hud = createHud();
    const host = createMenuHost({
      actions: () => [{ id: 'cut', label: 'Cut', invoker: { timing: 'immediate' as const, run: () => {} } }],
      depsFor: () => undefined, trigger: () => true, activeTool: () => null,
    });
    host.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
    const p0: Widget = {
      id: 'p0', bounds: { x: 700, y: 0, w: 20, h: 20 }, hidden: false, focusable: true,
      draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
    };
    hud.add(p0);
    let detach = attachMenuHost(hud, host, opts);
    hud.moveFocus('next');
    host.open({ menu: 'row', client: { x: 0, y: 0 } });
    expect(hud.focused).not.toBe(p0);
    detach();
    expect(hud.focused).toBe(p0);
    detach = attachMenuHost(hud, host, opts);
    host.close();
    expect(hud.focused).toBe(p0);
    detach();
  });
});

describe('attachMenuHost under a focus listener that opens a menu, shrunk', () => {
  it('keeps a menu opened by a focus listener heard ahead of the host', () => {
    const hud = createHud();
    const host = createMenuHost({
      actions: () => [{ id: 'cut', label: 'Cut', invoker: { timing: 'immediate' as const, run: () => {} } }],
      depsFor: () => undefined, trigger: () => true, activeTool: () => null,
    });
    host.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
    const p: Widget = {
      id: 'p', bounds: { x: 700, y: 0, w: 20, h: 20 }, hidden: false, focusable: true,
      draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
    };
    hud.add(p);
    // Subscribed before the host attaches, so it hears each focus report first.
    hud.subscribeFocus((f) => { if (f === p) host.open({ menu: 'row', client: { x: 5, y: 5 } }); });
    const detach = attachMenuHost(hud, host, opts);
    hud.focus(p);
    expect(host.current()).not.toBeNull();
    expect(hud.widgets()).toHaveLength(2);
    expect(hud.focused).toBe(hud.widgets()[1]);
    detach();
  });
});
