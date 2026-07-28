/**
 * Behavioral tests for Canvas without a selection prop.
 *
 * After the refactor:
 *  1. Canvas renders without throwing even when no selection prop is passed.
 *  2. Canvas does not install document-level selection-backstop listeners when
 *     `onBackgroundClick` is absent. (The doc-level pointerup/cancel listeners
 *     for gesture completion are still installed on pointerdown — the assertion
 *     here is specifically that no selection-clear backstop installs at mount.)
 *  3. Canvas fires `onBackgroundClick` when supplied and the canvas receives a
 *     pointer event that the tool dispatcher does not handle (no active gesture).
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';

// jsdom doesn't implement getContext or pointer capture; stub minimally.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  if (!(proto.getContext as unknown as { _stubbed?: boolean })._stubbed) {
    proto.getContext = Object.assign(vi.fn(() => null), { _stubbed: true });
    proto.setPointerCapture = vi.fn();
    proto.releasePointerCapture = vi.fn();
  }
});

describe('<Canvas> without selection prop', () => {
  it('renders without throwing when no selection prop is passed', () => {
    const { container } = render(<Canvas width={100} height={100} layers={{}} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('does not install document-level selection-backstop listeners when onBackgroundClick is absent', () => {
    // Canvas installs keydown/keyup listeners unconditionally (for tools
    // routing) and, during an active gesture, pointerup/pointermove/cancel.
    // What it must NOT do is install a persistent selection-clear backstop
    // at mount time when onBackgroundClick is absent.
    //
    // We spy on document.addEventListener and count how many times it is
    // called during mount. Legitimate calls at mount time:
    //   - keydown, keyup (always, for tool dispatcher)
    // That is all — no pointerdown, pointerup, click, or pointermove installs
    // should happen at mount when no tools prop is supplied either.
    const spy = vi.spyOn(document, 'addEventListener');
    render(<Canvas width={100} height={100} layers={{}} />);
    const calls = spy.mock.calls.map(c => c[0]);
    // No persistent selection-related backstop listeners.
    const selectionLike = calls.filter(
      (type) => type === 'click' || type === 'pointerdown'
    );
    expect(selectionLike).toEqual([]);
    spy.mockRestore();
  });

  // `onBackgroundClick` is gone. It fired when the tool dispatcher hadn't
  // claimed the pointer, which is not a distinction `<Canvas>` can make now
  // that it doesn't route input. A consumer wanting "clicked empty canvas"
  // binds `{ kind: 'click', target: 'empty' }`, the way `clearSelection` does.
});
