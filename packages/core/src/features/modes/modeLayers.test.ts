import { describe, it, expect, vi } from 'vitest';
import { createModeDecorations, createModeRegistry, type ModeDefinition } from '@weasel-js/modes';
import { modeDecorationLayer, workspaceTintLayer } from './modeLayers';
import type { View } from 'core/viewport/view';

const MODES: readonly ModeDefinition[] = [
  { id: 'plain', kind: 'soft', allows: [], scoping: false },
  { id: 'wash', kind: 'soft', allows: [], scoping: false, workspace: { tint: '#ff0000', intensity: 0.5 } },
  { id: 'rise', kind: 'soft', allows: [], scoping: false, workspace: { tint: '#00ff00', gradient: 'bottom-up' } },
  { id: 'fall', kind: 'soft', allows: [], scoping: false, workspace: { tint: '#0000ff', gradient: 'top-down', intensity: 0.3 } },
];

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 200, height: 100 };

type Cmd = { kind: string; path: { x: number; y: number; width: number; height: number }; fill: Record<string, unknown> };
const draw = (layer: ReturnType<typeof workspaceTintLayer>, view = VIEW) => layer.draw(undefined, view, DIMS) as unknown as Cmd[];

describe('workspaceTintLayer', () => {
  it('paints nothing in a mode with no workspace tint', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'plain' });
    expect(draw(workspaceTintLayer({ registry }))).toEqual([]);
  });

  it('washes the whole viewport in a solid tint at the mode intensity', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'wash' });
    const [cmd, ...rest] = draw(workspaceTintLayer({ registry }));
    expect(rest).toEqual([]);
    expect(cmd!.path).toMatchObject({ x: 0, y: 0, width: 200, height: 100 });
    expect(cmd!.fill).toMatchObject({ paint: { kind: 'solid', color: '#ff0000', opacity: 0.5 } });
  });

  it('fades by the declared gradient direction, defaulting intensity to 0.12', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'rise' });
    const layer = workspaceTintLayer({ registry });
    const [rise] = draw(layer);
    expect(rise!.fill).toMatchObject({ paint: { kind: 'linear-gradient', from: { x: 0, y: 100 }, to: { x: 0, y: 0 }, opacity: 0.12 } });

    registry.setMode('fall');
    const [fall] = draw(layer);
    expect(fall!.fill).toMatchObject({ paint: { from: { x: 0, y: 0 }, to: { x: 0, y: 100 }, opacity: 0.3 } });
  });

  it('paints the fallback visual in a mode with no tint, and the mode\'s own over it', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'plain' });
    let on = true;
    const layer = workspaceTintLayer({ registry, fallback: { visual: () => (on ? { tint: '#8b5cf6', intensity: 0.2 } : null), subscribe: () => () => {} } });
    expect(draw(layer)[0]!.fill).toMatchObject({ paint: { kind: 'solid', color: '#8b5cf6', opacity: 0.2 } });
    registry.setMode('wash');
    expect(draw(layer)[0]!.fill).toMatchObject({ paint: { color: '#ff0000' } });
    registry.setMode('plain');
    on = false;
    expect(draw(layer)).toEqual([]);
  });

  it('repaints on the fallback\'s changes as well as the registry\'s', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'plain' });
    const offFallback = vi.fn();
    const subscribe = vi.fn(() => offFallback);
    const layer = workspaceTintLayer({ registry, fallback: { visual: () => null, subscribe } });
    const repaint = vi.fn();
    const off = layer.subscribe!(repaint);
    expect(subscribe).toHaveBeenCalledWith(repaint);
    registry.setMode('wash');
    expect(repaint).toHaveBeenCalled();
    off();
    expect(offFallback).toHaveBeenCalled();
  });

  it('lets the caller override every mode intensity', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'wash' });
    const [cmd] = draw(workspaceTintLayer({ registry, intensity: 0.4 }));
    expect(cmd!.fill).toMatchObject({ paint: { opacity: 0.4 } });
  });

  it('leaves the page uncovered, tinting the four strips around it', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'rise' });
    const layer = workspaceTintLayer({ registry, page: () => ({ x: 50, y: 20, width: 100, height: 60 }) });
    const rects = draw(layer).map((c) => c.path);
    expect(rects).toEqual([
      { kind: 'rect', x: 0, y: 0, width: 200, height: 20 },
      { kind: 'rect', x: 0, y: 80, width: 200, height: 20 },
      { kind: 'rect', x: 0, y: 20, width: 50, height: 60 },
      { kind: 'rect', x: 150, y: 20, width: 50, height: 60 },
    ]);
  });

  it('projects the page through the view', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'wash' });
    const layer = workspaceTintLayer({ registry, page: () => ({ x: 0, y: 0, width: 50, height: 25 }) });
    const zoomed: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };
    const rects = draw(layer, zoomed).map((c) => c.path);
    expect(rects[0]).toMatchObject({ x: 0, y: 50, width: 200, height: 50 });
  });

  it('washes the whole viewport when the page is scrolled out of it', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'wash' });
    const layer = workspaceTintLayer({ registry, page: () => ({ x: 500, y: 500, width: 10, height: 10 }) });
    const cmds = draw(layer);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]!.path).toMatchObject({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('is a screen-space layer that follows the registry', () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'plain' });
    const layer = workspaceTintLayer({ registry });
    expect(layer.space).toBe('screen');
    const listener = vi.fn();
    const off = layer.subscribe!(listener);
    registry.setMode('wash');
    expect(listener).toHaveBeenCalledOnce();
    off();
  });
});

describe('modeDecorationLayer', () => {
  it("draws the active mode's decorations and follows the decoration registry", () => {
    const registry = createModeRegistry({ modes: MODES, initial: 'plain' });
    const decorations = createModeDecorations({ registry });
    const cmd = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } };
    decorations.register('wash', () => [cmd]);
    const layer = modeDecorationLayer(decorations);
    expect(layer.draw(undefined, VIEW, DIMS)).toEqual([]);

    const listener = vi.fn();
    layer.subscribe!(listener);
    registry.setMode('wash');
    expect(listener).toHaveBeenCalledOnce();
    expect(layer.draw(undefined, VIEW, DIMS)).toEqual([cmd]);
  });
});
