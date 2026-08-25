import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingPanel } from './FloatingPanel';

// The shared stub reports one size for every element, which makes the panel and
// its container the same box. Report per-target sizes instead so placement math
// has something real to chew on. Keyed by class, because `observe()` fires
// synchronously inside the effect — before a test could register an element.
const sizes = { host: { w: 400, h: 300 }, panel: { w: 100, h: 40 } };
const realRO = globalThis.ResizeObserver;

beforeEach(() => {
  localStorage.clear();
  sizes.host = { w: 400, h: 300 };
  sizes.panel = { w: 100, h: 40 };
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      const { w, h } = target.classList.contains('lk-floating-panel') ? sizes.panel : sizes.host;
      const contentRect = { width: w, height: h, x: 0, y: 0, top: 0, left: 0 };
      this.#cb([{ target, contentRect } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = realRO;
});

/** Renders a panel in a 400x300 host, the panel itself measuring 100x40. */
function renderPanel(ui: React.ReactElement) {
  const result = render(<div>{ui}</div>);
  return { ...result, panel: result.container.querySelector('.lk-floating-panel') as HTMLElement };
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
    const { container } = render(<FloatingPanel className="is-mine">x</FloatingPanel>);
    expect(container.querySelector('.lk-floating-panel')?.className).toContain('is-mine');
  });

  it('rests in the bottom-left corner by default, one inset in', () => {
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    expect(panel.style.left).toBe('12px');
    expect(panel.style.top).toBe('248px'); // 300 - 40 - 12
  });

  it('honors the anchor it is given', () => {
    const { panel } = renderPanel(<FloatingPanel anchor="top-right">x</FloatingPanel>);
    expect(panel.style.left).toBe('288px'); // 400 - 100 - 12
    expect(panel.style.top).toBe('12px');
  });

  it('honors a custom inset', () => {
    const { panel } = renderPanel(
      <FloatingPanel anchor="top-left" inset={30}>
        x
      </FloatingPanel>,
    );
    expect(panel.style.left).toBe('30px');
    expect(panel.style.top).toBe('30px');
  });

  it('stays hidden until it has been measured and placed', () => {
    sizes.panel = { w: 0, h: 0 };
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    // The strategy withholds an item with no size, so there is no rect to paint.
    expect(panel.getAttribute('data-placed')).toBeNull();
  });

  it('marks itself placed once it has a rect', () => {
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    expect(panel.dataset.placed).toBe('true');
  });
});
