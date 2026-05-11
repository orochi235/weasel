import { describe, it, expect, vi } from 'vitest';
import { createHud } from './hud';
import type { HudHost } from './host';
import type { Widget } from './widget';

function makeHost(): HudHost & { redrawCount: number } {
  const host = {
    redrawCount: 0,
    requestRedraw() { this.redrawCount++; },
    registerLayer: vi.fn(() => () => {}),
  };
  return host;
}

function makeWidget(id: string): Widget {
  return {
    id, bounds: { x: 0, y: 0, w: 10, h: 10 }, hidden: false,
    draw: () => [], hitTest: () => false, onPointer: () => 'pass',
    dispose: () => {},
  };
}

describe('Hud', () => {
  it('add() inserts widget and requests redraw when bound', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    const w = makeWidget('w1');
    hud.add(w);
    expect(hud.widgets()).toEqual([w]);
    expect(host.redrawCount).toBe(1);
  });

  it('add() before bind queues without crashing; bind triggers initial redraw', () => {
    const hud = createHud();
    const w = makeWidget('w1');
    hud.add(w);
    expect(hud.widgets()).toEqual([w]);
    const host = makeHost();
    hud.bind(host);
    expect(host.redrawCount).toBe(1);
  });

  it('remove() drops widget and calls dispose', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    const dispose = vi.fn();
    const w = { ...makeWidget('w1'), dispose };
    hud.add(w);
    hud.remove(w);
    expect(hud.widgets()).toEqual([]);
    expect(dispose).toHaveBeenCalled();
  });

  it('markDirty triggers redraw when bound', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    hud.markDirty();
    expect(host.redrawCount).toBe(1);
  });

  it('markDirty before bind is a no-op (no crash, no redraw)', () => {
    const hud = createHud();
    expect(() => hud.markDirty()).not.toThrow();
  });

  it('detached HUD warns instead of throwing on widget add', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    hud.unbind();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    hud.add(makeWidget('w1'));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rect() factory creates widget and adds it to the list', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    const r = hud.rect({ id: 'r', x: 0, y: 0, w: 10, h: 10, fill: '#000' });
    expect(hud.widgets()).toEqual([r]);
  });

  it('mutating a hud-managed rect triggers redraw via injected onChange', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    const r = hud.rect({ id: 'r', x: 0, y: 0, w: 10, h: 10, fill: '#000' });
    const before = host.redrawCount;
    r.setFill('#fff');
    expect(host.redrawCount).toBe(before + 1);
  });
});
