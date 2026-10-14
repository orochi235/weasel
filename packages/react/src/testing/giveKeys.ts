import type { ReactElement } from 'react';
import { act, render, type RenderOptions, type RenderResult } from '@testing-library/react';

/**
 * Give a canvas the keyboard the way a user does: by pressing in it. Keys that
 * reach the page go to the canvas last pressed or scrolled, and to none before
 * that, so a test that fires a key at `window` presses first. The press is a
 * middle-button one, released at once, which activates the canvas's input
 * scope and starts no gesture, so nothing is picked, dragged, or clicked.
 *
 * `canvas` defaults to the first `<canvas>` in the document.
 */
export function giveKeys(canvas?: Element | null): void {
  const el = canvas ?? document.querySelector('canvas');
  if (!el) throw new Error('giveKeys: no canvas to press in');
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', { button: 1, bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { button: 1, bubbles: true }));
  });
}

/**
 * `render`, then {@link giveKeys} to the canvas it mounted, if it mounted one:
 * the starting point of a test that goes on to fire keys at `window`. Import
 * it as `render` in a file whose tests all want that.
 */
export function renderWithKeys(ui: ReactElement, options?: RenderOptions): RenderResult {
  const result = render(ui, options);
  const canvas = result.container.querySelector('canvas') ?? document.querySelector('canvas');
  if (canvas) giveKeys(canvas);
  return result;
}
