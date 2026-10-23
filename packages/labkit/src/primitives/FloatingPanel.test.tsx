import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { labPrefix } from '../state/labRecords';
import { Persistence } from '../state/Persistence';
import { FloatingPanel } from './FloatingPanel';

// The shared stub reports one size for every element, which makes the panel and
// its container the same box. Report per-target sizes instead so placement math
// has something real to chew on. Keyed by class, because `observe()` fires
// synchronously inside the effect — before a test could register an element.
const sizes = { host: { w: 400, h: 300 }, panel: { w: 100, h: 40 } };
const realRO = globalThis.ResizeObserver;
const realCapture = Element.prototype.setPointerCapture;

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
  Element.prototype.setPointerCapture = realCapture;
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

  it('starts in the anchor it is given', () => {
    const { panel } = renderPanel(<FloatingPanel anchor="top-right">x</FloatingPanel>);
    expect(panel.style.left).toBe('288px'); // 400 - 100 - 12
    expect(panel.style.top).toBe('12px');
  });

  it('passes its inset through', () => {
    const { panel } = renderPanel(
      <FloatingPanel anchor="top-left" inset={30}>
        x
      </FloatingPanel>,
    );
    expect(panel.style.left).toBe('30px');
  });

  it('marks itself placed once it has a rect', () => {
    const { panel } = renderPanel(<FloatingPanel>x</FloatingPanel>);
    expect(panel.dataset.placed).toBe('true');
  });
});

describe('FloatingPanel dragging, through useFloatingPlacement', () => {
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

describe('FloatingPanel persistence', () => {
  const PLACE = `${labPrefix('fp')}value:lab:legend`;

  function persisted(backing: Map<string, unknown>, ui: React.ReactElement) {
    return render(
      <Persistence storageKey="fp" storage={createMemoryAdapter(backing)}>
        <div>{ui}</div>
      </Persistence>,
    );
  }

  it('writes its placement under its persist name once dragged', async () => {
    const backing = new Map<string, unknown>();
    const { container } = persisted(backing, <FloatingPanel persist="legend">x</FloatingPanel>);
    await waitFor(() => expect(container.querySelector('.lk-floating-panel')).not.toBeNull());
    const panel = container.querySelector('.lk-floating-panel') as HTMLElement;
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { clientX: 140, clientY: 160 });
    fireEvent.pointerUp(panel);
    await waitFor(() =>
      expect(backing.get(PLACE)).toMatchObject({ x: expect.any(Number), y: expect.any(Number) }),
    );
    expect(backing.get(PLACE)).toHaveProperty('anchor');
  });

  it('restores what it stored on a later mount', async () => {
    const backing = new Map<string, unknown>([[PLACE, { x: 140, y: 90, anchor: null }]]);
    const { container } = persisted(backing, <FloatingPanel persist="legend">x</FloatingPanel>);
    // Placed only once both boxes are measured, which can land a render later.
    await waitFor(() =>
      expect(
        (container.querySelector('.lk-floating-panel') as HTMLElement | null)?.style.left,
      ).toBe('140px'),
    );
    const panel = container.querySelector('.lk-floating-panel') as HTMLElement;
    expect(panel.style.top).toBe('90px');
  });

  it('writes nothing without a persist name', async () => {
    const backing = new Map<string, unknown>();
    const { container, unmount } = persisted(backing, <FloatingPanel>x</FloatingPanel>);
    await waitFor(() => expect(container.querySelector('.lk-floating-panel')).not.toBeNull());
    const panel = container.querySelector('.lk-floating-panel') as HTMLElement;
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { clientX: 140, clientY: 160 });
    fireEvent.pointerUp(panel);
    unmount();
    await new Promise((r) => setTimeout(r, 20));
    expect(backing.size).toBe(0);
  });

  it('forgets its placement with no provider above it', () => {
    const first = renderPanel(<FloatingPanel persist="legend">x</FloatingPanel>);
    fireEvent.pointerDown(first.panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(first.panel, { clientX: 140, clientY: 60 });
    fireEvent.pointerUp(first.panel);
    expect(first.panel.style.top).not.toBe('248px');
    first.unmount();

    const { panel } = renderPanel(<FloatingPanel persist="legend">x</FloatingPanel>);
    expect(panel.style.left).toBe('12px');
    expect(panel.style.top).toBe('248px');
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
        {/* biome-ignore lint/a11y/useSemanticElements: a non-native control is the subject */}
        <span data-testid="row" role="button" tabIndex={0}>
          row
        </span>
      </FloatingPanel>,
    );
    const row = screen.getByTestId('row');
    fireEvent.pointerDown(row, { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
    expect(captured).toEqual([]);
  });
});
