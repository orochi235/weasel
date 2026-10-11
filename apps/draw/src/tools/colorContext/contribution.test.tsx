/**
 * The color keys ride the canvas's dispatcher: D resets, X swaps, Shift+X
 * swaps focus, and / toggles the focused paint to none.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, createScene } from '@weasel-js/core';
import { colorContribution } from './contribution';
import type { ColorContextValue } from './ColorContextProvider';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

function setup() {
  const color = { reset: vi.fn(), swap: vi.fn(), swapFocus: vi.fn(), toggleFocusedNone: vi.fn() };
  const scene = createScene<object, 'main', { x: number; y: number; width: number; height: number }>(
    { systemLayers: [{ id: 'main' }] },
  );
  const ambient = [colorContribution(() => color as unknown as ColorContextValue)];
  render(<SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} ambient={ambient} />);
  const key = (key: string, init: KeyboardEventInit = {}) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
  return { color, key };
}

describe('color keys', () => {
  it('X swaps fill and stroke', () => {
    const t = setup();
    t.key('x');
    expect(t.color.swap).toHaveBeenCalledOnce();
    expect(t.color.swapFocus).not.toHaveBeenCalled();
  });

  it('Shift+X swaps which paint is focused', () => {
    const t = setup();
    t.key('X', { shiftKey: true });
    expect(t.color.swapFocus).toHaveBeenCalledOnce();
    expect(t.color.swap).not.toHaveBeenCalled();
  });

  it('D resets both paints', () => {
    const t = setup();
    t.key('d');
    expect(t.color.reset).toHaveBeenCalledOnce();
  });

  it('/ toggles the focused paint to none', () => {
    const t = setup();
    t.key('/');
    expect(t.color.toggleFocusedNone).toHaveBeenCalledOnce();
  });

  it('leaves Cmd+D to duplicate', () => {
    const t = setup();
    t.key('d', { metaKey: true });
    expect(t.color.reset).not.toHaveBeenCalled();
  });
});
