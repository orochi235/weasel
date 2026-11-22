/**
 * The color keys ride the canvas's dispatcher: D resets, X swaps, Shift+X
 * swaps focus, and / toggles the focused paint to none; each but Shift+X
 * paints the selection with what it set.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, createScene } from '@weasel-js/core';
import { colorContribution } from './contribution';
import type { ColorContextValue } from './ColorContextProvider';
import * as presets from '@weasel-js/editing/presets';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

const WHITE = { kind: 'solid' as const, color: '#ffffff' };
const BLACK = { kind: 'solid' as const, color: '#000000' };

function setup() {
  const color = {
    reset: vi.fn(() => ({ fill: WHITE, stroke: BLACK })),
    swap: vi.fn(() => ({ fill: BLACK, stroke: WHITE })),
    swapFocus: vi.fn(),
    toggleFocusedNone: vi.fn(() => ({ slot: 'stroke' as const, paint: null })),
  };
  const paint = vi.fn();
  const scene = createScene<object, 'main', { x: number; y: number; width: number; height: number }>(
    { systemLayers: [{ id: 'main' }] },
  );
  const ambient = [colorContribution(() => color as unknown as ColorContextValue, () => paint)];
  render(<SceneCanvas features={[presets.draw]} scene={scene} layers={{}} width={64} height={64} ambient={ambient} />);
  const key = (key: string, init: KeyboardEventInit = {}) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
  return { color, paint, key };
}

describe('color keys', () => {
  it('X swaps fill and stroke', () => {
    const t = setup();
    t.key('x');
    expect(t.color.swap).toHaveBeenCalledOnce();
    expect(t.color.swapFocus).not.toHaveBeenCalled();
  });

  it('X paints the selection with both swapped paints, as one edit', () => {
    const t = setup();
    t.key('x');
    expect(t.paint).toHaveBeenCalledExactlyOnceWith({ fill: BLACK, stroke: WHITE }, 'Swap fill and stroke');
  });

  it('Shift+X swaps which paint is focused', () => {
    const t = setup();
    t.key('X', { shiftKey: true });
    expect(t.color.swapFocus).toHaveBeenCalledOnce();
    expect(t.color.swap).not.toHaveBeenCalled();
    expect(t.paint).not.toHaveBeenCalled();
  });

  it('D resets both paints', () => {
    const t = setup();
    t.key('d');
    expect(t.color.reset).toHaveBeenCalledOnce();
  });

  it('D paints the selection with the default paints', () => {
    const t = setup();
    t.key('d');
    expect(t.paint).toHaveBeenCalledExactlyOnceWith({ fill: WHITE, stroke: BLACK }, 'Reset colors');
  });

  it('/ toggles the focused paint to none', () => {
    const t = setup();
    t.key('/');
    expect(t.color.toggleFocusedNone).toHaveBeenCalledOnce();
  });

  it('/ paints the selection with the none it toggled the focused paint to', () => {
    const t = setup();
    t.key('/');
    expect(t.paint).toHaveBeenCalledExactlyOnceWith({ stroke: null }, 'Set stroke');
  });

  it('leaves Cmd+D to transform again', () => {
    const t = setup();
    t.key('d', { metaKey: true });
    expect(t.color.reset).not.toHaveBeenCalled();
  });
});
