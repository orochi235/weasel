/**
 * A mode's declared shortcuts reach the canvas's dispatcher as bindings gated
 * on the active mode, installed by the `modeShortcuts` contribution.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { createModeRegistry, DEFAULT_MODES, getActiveModeFor, type ModeRegistry } from '@weasel-js/modes';
import { modeShortcuts, type ModeShortcutHandlers } from '@weasel-js/routing';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

const ID = asNodeId('a');

function setup(initial: string, handlers: ModeShortcutHandlers, { wireMode = true } = {}) {
  const registry: ModeRegistry = createModeRegistry({ modes: DEFAULT_MODES, initial });
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'leaf', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } });
  scene.setSelection([ID]);
  const getActiveMode = getActiveModeFor(registry);
  const { container } = render(
    <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
      ambient={[modeShortcuts(registry, handlers)]}
      {...(wireMode ? { getActiveMode } : {})} />,
  );
  const key = (key: string, init: KeyboardEventInit = {}) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
  const canvas = container.querySelector('canvas')!;
  const pointer = (type: string, x: number, y: number) => act(() => {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  });
  return { registry, scene, key, pointer, selected: () => scene.getSelection() };
}

describe('mode shortcuts', () => {
  it("leave a soft mode on its exit shortcut, ahead of Escape's clear-selection", () => {
    const exit = vi.fn();
    const t = setup('path-edit', { exit });
    t.key('Escape');
    expect(exit).toHaveBeenCalledOnce();
    expect(t.selected()).toEqual([ID]);
  });

  it('leave Escape to the rest of the ladder in a mode that declares nothing for it', () => {
    const exit = vi.fn();
    const cancel = vi.fn();
    const t = setup('normal', { exit, cancel });
    t.key('Escape');
    expect(exit).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(t.selected()).toEqual([]);
  });

  it('yield to cancelling a gesture in flight', () => {
    const exit = vi.fn();
    const t = setup('isolation', { exit });
    t.pointer('pointerdown', 40, 40);
    t.pointer('pointermove', 55, 55);
    t.key('Escape');
    expect(exit).not.toHaveBeenCalled();
    t.pointer('pointerup', 55, 55);
    t.key('Escape');
    expect(exit).toHaveBeenCalledOnce();
  });

  it('commit and cancel a strict mode', () => {
    const commit = vi.fn();
    const cancel = vi.fn();
    const t = setup('free-transform', { commit, cancel });
    t.key('Enter');
    expect(commit).toHaveBeenCalledOnce();
    t.key('Escape');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('discard a soft mode on its modified shortcut, and only discard', () => {
    const exit = vi.fn();
    const discard = vi.fn();
    const t = setup('path-edit', { exit, discard });
    t.key('Escape', { metaKey: true });
    expect(discard).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it('enter a mode from another one, unless the handler says it cannot', () => {
    const enter = vi.fn();
    let ready = false;
    const t = setup('normal', { enter, canEnter: () => ready });
    t.key('T', { metaKey: true });
    expect(enter).not.toHaveBeenCalled();
    ready = true;
    t.key('T', { metaKey: true });
    expect(enter).toHaveBeenCalledWith('free-transform');
  });

  it('bind no role the handlers leave out', () => {
    const t = setup('path-edit', {});
    t.key('Escape');
    expect(t.selected()).toEqual([]);
  });

  it('stay inert on a canvas with no mode wired, rather than swallow the key', () => {
    const exit = vi.fn();
    const t = setup('path-edit', { exit }, { wireMode: false });
    t.registry.setMode('normal');
    t.key('Escape');
    expect(exit).not.toHaveBeenCalled();
    expect(t.selected()).toEqual([]);
  });
});
