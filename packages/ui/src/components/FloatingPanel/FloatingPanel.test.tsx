import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingPanel } from './FloatingPanel';
import s from './FloatingPanel.module.css';

// The shared stub reports one size for every element, which makes the panel and
// its container the same box. Report per-target sizes instead, keyed by class,
// because `observe()` fires synchronously inside the effect.
const sizes = { host: { w: 400, h: 300 }, panel: { w: 100, h: 40 } };
const realRO = globalThis.ResizeObserver;
const realCapture = Element.prototype.setPointerCapture;

beforeEach(() => {
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      const { w, h } = target.classList.contains(s.panel) ? sizes.panel : sizes.host;
      const contentRect = { width: w, height: h, x: 0, y: 0, top: 0, left: 0 };
      this.#cb([{ target, contentRect } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = realRO;
  Element.prototype.setPointerCapture = realCapture;
});

/** Renders a panel in a 400x300 host, the panel itself measuring 100x40. */
function renderPanel(ui: ReactElement) {
  const result = render(<div>{ui}</div>);
  return { ...result, panel: result.container.querySelector(`.${s.panel}`) as HTMLElement };
}

function drag(panel: HTMLElement, dx: number, dy: number) {
  fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(panel, { clientX: 100 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(panel);
}

describe('FloatingPanel', () => {
  it('renders its children', () => {
    render(<FloatingPanel>hello</FloatingPanel>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('is absolutely positioned so it floats over whatever it sits in', () => {
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    expect(panel.style.position).toBe('absolute');
  });

  it('accepts an extra class name', () => {
    const { panel } = renderPanel(<FloatingPanel className="is-mine">x</FloatingPanel>);
    expect(panel.className).toContain('is-mine');
  });

  it('rests in the bottom-left corner by default, one inset in', () => {
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    expect(panel.style.left).toBe('12px');
    expect(panel.style.top).toBe('248px'); // 300 - 40 - 12
  });

  it('starts in the anchor it is given', () => {
    const { panel } = renderPanel(<FloatingPanel anchor="top-right">x</FloatingPanel>);
    expect(panel.style.left).toBe('288px'); // 400 - 100 - 12
    expect(panel.style.top).toBe('12px');
  });

  it('passes its inset through', () => {
    const { panel } = renderPanel(<FloatingPanel anchor="top-left" inset={30}>x</FloatingPanel>);
    expect(panel.style.left).toBe('30px');
  });

  it('marks itself placed once it has a rect', () => {
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    expect(panel.dataset.placed).toBe('true');
  });

  it('marks itself dragging once the pointer moves, not on the press', () => {
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    expect(panel.dataset.dragging).toBeUndefined();
    fireEvent.pointerMove(panel, { clientX: 140, clientY: 100 });
    expect(panel.dataset.dragging).toBe('true');
    fireEvent.pointerUp(panel);
    expect(panel.dataset.dragging).toBeUndefined();
  });
});

describe('FloatingPanel placement', () => {
  it('rests where its value says', () => {
    const { panel } = renderPanel(<FloatingPanel value={{ x: 140, y: 90, anchor: null }}>x</FloatingPanel>);
    expect(panel.style.left).toBe('140px');
    expect(panel.style.top).toBe('90px');
  });

  it('reports a drag through onChange, once, on release', () => {
    const onChange = vi.fn();
    const { panel } = renderPanel(<FloatingPanel onChange={onChange}>x</FloatingPanel>);
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { clientX: 140, clientY: 60 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(panel);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(onChange.mock.calls[0][0]).toHaveProperty('anchor');
  });

  it('holds its own placement when it is given no value', () => {
    const { panel, rerender } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    drag(panel, 40, -100);
    rerender(<div><FloatingPanel>x</FloatingPanel></div>);
    expect(panel.style.top).not.toBe('248px');
  });

  it('moves to a new value its owner passes', () => {
    const { panel, rerender } = renderPanel(<FloatingPanel value={{ x: 10, y: 20, anchor: null }}>x</FloatingPanel>);
    rerender(<div><FloatingPanel value={{ x: 50, y: 60, anchor: null }}>x</FloatingPanel></div>);
    expect(panel.style.left).toBe('50px');
    expect(panel.style.top).toBe('60px');
  });
});

describe('a child that is not a native control', () => {
  // The real symptom — capture retargets mouseup, so the browser synthesizes no
  // `click` on the child — cannot be reproduced in jsdom, which fires the click
  // either way. Capture-on-press is the observable proxy for it.
  it('does not capture the pointer until the pointer has actually moved', () => {
    const captured: number[] = [];
    Element.prototype.setPointerCapture = (id: number) => {
      captured.push(id);
    };
    render(
      <FloatingPanel>
        <span data-testid="row" role="button" tabIndex={0}>row</span>
      </FloatingPanel>,
    );
    fireEvent.pointerDown(screen.getByTestId('row'), { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
    expect(captured).toEqual([]);
  });
});
