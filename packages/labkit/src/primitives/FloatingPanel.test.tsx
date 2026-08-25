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

describe('FloatingPanel dragging', () => {
  it('marks itself dragging between pointerdown and pointerup', () => {
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    expect(panel.dataset.dragging).toBe('true');
    fireEvent.pointerUp(panel);
    expect(panel.dataset.dragging).toBeUndefined();
  });

  it('moves with the pointer, accumulating across moves', () => {
    const { panel } = renderPanel(<FloatingPanel anchor="top-left">x</FloatingPanel>);
    expect(panel.style.left).toBe('12px');
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { clientX: 200, clientY: 180 });
    expect(panel.style.left).toBe('100px');
    expect(panel.style.top).toBe('80px');
    fireEvent.pointerMove(panel, { clientX: 250, clientY: 180 });
    expect(panel.style.left).toBe('150px');
    expect(panel.style.top).toBe('80px');
  });

  it('snaps to a corner when dropped near one', () => {
    const { panel } = renderPanel(<FloatingPanel anchor="top-left">x</FloatingPanel>);
    fireEvent.pointerDown(panel, { clientX: 0, clientY: 0 });
    // Aim at the bottom-right corner; the snap threshold captures it.
    fireEvent.pointerMove(panel, { clientX: 400, clientY: 300 });
    expect(panel.style.left).toBe('288px'); // 400 - 100 - 12
    expect(panel.style.top).toBe('248px'); // 300 - 40 - 12
  });

  it('refuses a corner it was not given', () => {
    const { panel } = renderPanel(
      <FloatingPanel anchor="top-left" snapCorners={['top-left']}>
        x
      </FloatingPanel>,
    );
    fireEvent.pointerDown(panel, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(panel, { clientX: 400, clientY: 300 });
    // Clamped inside the container, but not snapped to the bottom-right inset.
    expect(panel.style.left).toBe('300px');
    expect(panel.style.top).toBe('260px');
  });

  it('does not start a drag from an interactive child', () => {
    const { panel } = renderPanel(
      <FloatingPanel>
        <button type="button">press</button>
      </FloatingPanel>,
    );
    fireEvent.pointerDown(screen.getByRole('button'), { clientX: 10, clientY: 10 });
    expect(panel.dataset.dragging).toBeUndefined();
  });

  it('does not start a drag from a child opting out', () => {
    const { panel } = renderPanel(
      <FloatingPanel>
        <span data-no-drag="">nope</span>
      </FloatingPanel>,
    );
    fireEvent.pointerDown(screen.getByText('nope'), { clientX: 10, clientY: 10 });
    expect(panel.dataset.dragging).toBeUndefined();
  });

  it('stops the pointerdown reaching a pan/zoom surface underneath', () => {
    const onDown = vi.fn();
    const { container } = render(
      <div onPointerDown={onDown}>
        <FloatingPanel>x</FloatingPanel>
      </div>,
    );
    fireEvent.pointerDown(container.querySelector('.lk-floating-panel') as HTMLElement, {
      clientX: 5,
      clientY: 5,
    });
    expect(onDown).not.toHaveBeenCalled();
  });

  it('lets a pointerdown on an interactive child through to the surface', () => {
    const onDown = vi.fn();
    render(
      <div onPointerDown={onDown}>
        <FloatingPanel>
          <button type="button">press</button>
        </FloatingPanel>
      </div>,
    );
    fireEvent.pointerDown(screen.getByRole('button'), { clientX: 5, clientY: 5 });
    expect(onDown).toHaveBeenCalledTimes(1);
  });
});
