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
});
