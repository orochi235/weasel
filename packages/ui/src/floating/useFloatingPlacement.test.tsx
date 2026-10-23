import { act, fireEvent, render, screen } from '@testing-library/react';
import { DRAG_THRESHOLD_PX } from '@weasel-js/core';
import { type ReactNode, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Corner, FloatingPlacement } from 'windease';
import { useFloatingPlacement } from './useFloatingPlacement';

// The shared stub reports one size for every element, which makes the panel and
// its container the same box. Report per-target sizes instead so placement math
// has something real to chew on. Keyed by a data attribute, because `observe()`
// fires synchronously inside the effect — before a test could register an element.
const sizes = { host: { w: 400, h: 300 }, panel: { w: 100, h: 40 } };
const realRO = globalThis.ResizeObserver;
const realCapture = Element.prototype.setPointerCapture;

beforeEach(() => {
  sizes.host = { w: 400, h: 300 };
  sizes.panel = { w: 100, h: 40 };
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      const { w, h } = target.hasAttribute('data-panel') ? sizes.panel : sizes.host;
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

interface HarnessProps {
  anchor?: Corner | null;
  inset?: number;
  snapCorners?: readonly Corner[];
  onChange?: (next: FloatingPlacement) => void;
  children?: ReactNode;
}

function Harness({ anchor = 'top-left', inset, snapCorners, onChange, children = 'x' }: HarnessProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<FloatingPlacement>({ x: 0, y: 0, anchor });
  const { style, startDrag, dragging, placed } = useFloatingPlacement({
    panelRef: ref,
    placement,
    onPlacementChange: (next) => {
      onChange?.(next);
      setPlacement(next);
    },
    inset,
    snapCorners,
  });
  return (
    <div
      data-dragging={dragging ? 'true' : undefined}
      data-panel=""
      data-placed={placed ? 'true' : undefined}
      onPointerDown={startDrag}
      ref={ref}
      style={style}
    >
      {children}
    </div>
  );
}

/** Renders a panel in a 400x300 host, the panel itself measuring 100x40. */
function renderPanel(ui: React.ReactElement) {
  const result = render(<div>{ui}</div>);
  return { ...result, panel: result.container.querySelector('[data-panel]') as HTMLElement };
}

describe('useFloatingPlacement placement', () => {
  it('is absolutely positioned so it floats over whatever it sits in', () => {
    const { panel } = renderPanel(<Harness />);
    expect(panel.style.position).toBe('absolute');
  });

  it('rests in its anchor corner, one inset in', () => {
    const { panel } = renderPanel(<Harness anchor="bottom-left" />);
    expect(panel.style.left).toBe('12px');
    expect(panel.style.top).toBe('248px'); // 300 - 40 - 12
  });

  it('honors the anchor it is given', () => {
    const { panel } = renderPanel(<Harness anchor="top-right" />);
    expect(panel.style.left).toBe('288px'); // 400 - 100 - 12
    expect(panel.style.top).toBe('12px');
  });

  it('honors a custom inset', () => {
    const { panel } = renderPanel(<Harness inset={30} />);
    expect(panel.style.left).toBe('30px');
    expect(panel.style.top).toBe('30px');
  });

  it('stays unplaced until it has been measured', () => {
    sizes.panel = { w: 0, h: 0 };
    const { panel } = renderPanel(<Harness />);
    // The strategy withholds an item with no size, so there is no rect to paint.
    expect(panel.getAttribute('data-placed')).toBeNull();
  });

  it('reports itself placed once it has a rect', () => {
    const { panel } = renderPanel(<Harness />);
    expect(panel.dataset.placed).toBe('true');
  });

  it('measures its border box, so padding does not push it past a corner', () => {
    // Same content box, but 8px padding and a 1px border on every side.
    globalThis.ResizeObserver = class {
      #cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.#cb = cb;
      }
      observe(target: Element) {
        const isPanel = target.hasAttribute('data-panel');
        const { w, h } = isPanel ? sizes.panel : sizes.host;
        const contentRect = { width: w, height: h, x: 0, y: 0, top: 0, left: 0 };
        const entry = {
          target,
          contentRect,
          ...(isPanel ? { borderBoxSize: [{ inlineSize: w + 18, blockSize: h + 18 }] } : {}),
        };
        this.#cb([entry as unknown as ResizeObserverEntry], this);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const { panel } = renderPanel(<Harness anchor="top-right" />);
    expect(panel.style.left).toBe('270px'); // 400 - (100 + 18) - 12
  });
});

describe('useFloatingPlacement dragging', () => {
  it('marks itself dragging once the pointer moves, not on the press', () => {
    const { panel } = renderPanel(<Harness />);
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    expect(panel.dataset.dragging).toBeUndefined();
    fireEvent.pointerMove(panel, { clientX: 140, clientY: 100 });
    expect(panel.dataset.dragging).toBe('true');
    fireEvent.pointerUp(panel);
    expect(panel.dataset.dragging).toBeUndefined();
  });

  it('becomes a drag at the kit drag threshold, not before', () => {
    const { panel } = renderPanel(<Harness />);
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { clientX: 100 + DRAG_THRESHOLD_PX - 0.5, clientY: 100 });
    expect(panel.dataset.dragging).toBeUndefined();
    fireEvent.pointerMove(panel, { clientX: 100 + DRAG_THRESHOLD_PX, clientY: 100 });
    expect(panel.dataset.dragging).toBe('true');
    fireEvent.pointerUp(panel);
  });

  it('a press that never moves is not a drag and reports nothing', () => {
    const onChange = vi.fn();
    const { panel } = renderPanel(<Harness onChange={onChange} />);
    const before = panel.style.left;
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(panel, { clientX: 100, clientY: 100 });
    expect(panel.dataset.dragging).toBeUndefined();
    expect(panel.style.left).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves with the pointer, accumulating across moves', () => {
    const { panel } = renderPanel(<Harness />);
    expect(panel.style.left).toBe('12px');
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { clientX: 200, clientY: 180 });
    expect(panel.style.left).toBe('100px');
    expect(panel.style.top).toBe('80px');
    fireEvent.pointerMove(panel, { clientX: 250, clientY: 180 });
    expect(panel.style.left).toBe('150px');
    expect(panel.style.top).toBe('80px');
  });

  it('reports the placement once, on release', () => {
    const onChange = vi.fn();
    const { panel } = renderPanel(<Harness onChange={onChange} />);
    fireEvent.pointerDown(panel, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { pointerId: 1, clientX: 200, clientY: 180 });
    fireEvent.pointerMove(panel, { pointerId: 1, clientX: 250, clientY: 180 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(panel, { pointerId: 1, clientX: 250, clientY: 180 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({ x: 150, y: 80, anchor: null });
    expect(panel.style.left).toBe('150px');
  });

  it('puts it back and reports nothing when Escape cancels the drag', () => {
    const onChange = vi.fn();
    const { panel } = renderPanel(<Harness onChange={onChange} />);
    fireEvent.pointerDown(panel, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { pointerId: 1, clientX: 200, clientY: 180 });
    expect(panel.style.left).toBe('100px');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(panel.dataset.dragging).toBeUndefined();
    expect(panel.style.left).toBe('12px');
    expect(panel.style.top).toBe('12px');
    fireEvent.pointerUp(panel, { pointerId: 1, clientX: 200, clientY: 180 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps to a corner when dropped near one', () => {
    const { panel } = renderPanel(<Harness />);
    fireEvent.pointerDown(panel, { clientX: 0, clientY: 0 });
    // Aim at the bottom-right corner; the snap threshold captures it.
    fireEvent.pointerMove(panel, { clientX: 400, clientY: 300 });
    expect(panel.style.left).toBe('288px'); // 400 - 100 - 12
    expect(panel.style.top).toBe('248px'); // 300 - 40 - 12
  });

  it('ends where the pointer says after a slow drag past a corner and back, not stuck to the corner', () => {
    const { panel } = renderPanel(<Harness />);
    fireEvent.pointerDown(panel, { pointerId: 1, buttons: 1, clientX: 100, clientY: 100 });
    const steps = 80;
    for (let i = 1; i <= steps; i++) {
      fireEvent.pointerMove(panel, { pointerId: 1, buttons: 1, clientX: 100 + i * 5, clientY: 100 + i * 4 });
    }
    expect(panel.style.left).toBe('288px');
    expect(panel.style.top).toBe('248px');
    for (let i = steps - 1; i >= 30; i--) {
      fireEvent.pointerMove(panel, { pointerId: 1, buttons: 1, clientX: 100 + i * 5, clientY: 100 + i * 4 });
    }
    expect(panel.style.left).toBe('150px');
    expect(panel.style.top).toBe('120px');
  });

  it('refuses a corner it was not given', () => {
    const { panel } = renderPanel(<Harness snapCorners={['top-left']} />);
    fireEvent.pointerDown(panel, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(panel, { clientX: 400, clientY: 300 });
    // Clamped inside the container, but not snapped to the bottom-right inset.
    expect(panel.style.left).toBe('300px');
    expect(panel.style.top).toBe('260px');
  });

  it('does not start a drag from any button but the primary', () => {
    const onDown = vi.fn();
    const { container } = render(
      <div onPointerDown={onDown}>
        <Harness />
      </div>,
    );
    const panel = container.querySelector('[data-panel]') as HTMLElement;
    fireEvent.pointerDown(panel, { pointerId: 1, button: 2, buttons: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { pointerId: 1, buttons: 2, clientX: 200, clientY: 180 });
    expect(panel.dataset.dragging).toBeUndefined();
    expect(panel.style.left).toBe('12px');
    expect(onDown).toHaveBeenCalledTimes(1);
  });

  it('does not start a drag from an interactive child', () => {
    const { panel } = renderPanel(
      <Harness>
        <button type="button">press</button>
      </Harness>,
    );
    fireEvent.pointerDown(screen.getByRole('button'), { clientX: 10, clientY: 10 });
    expect(panel.dataset.dragging).toBeUndefined();
  });

  it('does not start a drag from a child opting out', () => {
    const { panel } = renderPanel(
      <Harness>
        <span data-no-drag="">nope</span>
      </Harness>,
    );
    fireEvent.pointerDown(screen.getByText('nope'), { clientX: 10, clientY: 10 });
    expect(panel.dataset.dragging).toBeUndefined();
  });

  it('stops the pointerdown reaching a pan/zoom surface underneath', () => {
    const onDown = vi.fn();
    const { container } = render(
      <div onPointerDown={onDown}>
        <Harness />
      </div>,
    );
    fireEvent.pointerDown(container.querySelector('[data-panel]') as HTMLElement, {
      clientX: 5,
      clientY: 5,
    });
    expect(onDown).not.toHaveBeenCalled();
  });

  it('lets a pointerdown on an interactive child through to the surface', () => {
    const onDown = vi.fn();
    render(
      <div onPointerDown={onDown}>
        <Harness>
          <button type="button">press</button>
        </Harness>
      </div>,
    );
    fireEvent.pointerDown(screen.getByRole('button'), { clientX: 5, clientY: 5 });
    expect(onDown).toHaveBeenCalledTimes(1);
  });
});

describe('a clickable row nested in the panel', () => {
  // The real symptom — capture retargets mouseup, so the browser synthesizes no
  // `click` on the child — cannot be reproduced in jsdom, which fires the click
  // either way. Capture-on-press is the observable proxy for it.
  it('does not capture the pointer on a press two ancestors below the panel', () => {
    const captured: number[] = [];
    Element.prototype.setPointerCapture = (id: number) => {
      captured.push(id);
    };
    render(
      <Harness>
        <ul>
          <li>
            {/* biome-ignore lint/a11y/useSemanticElements: a non-native control is the subject */}
            <span data-testid="row" role="button" tabIndex={0}>
              row
            </span>
          </li>
        </ul>
      </Harness>,
    );
    fireEvent.pointerDown(screen.getByTestId('row'), {
      pointerId: 1,
      button: 0,
      clientX: 40,
      clientY: 40,
    });
    expect(captured).toEqual([]);
  });

  it('still drags when the press that started in the list actually moves', () => {
    const { panel } = renderPanel(
      <Harness>
        <ul>
          <li>row</li>
        </ul>
      </Harness>,
    );
    fireEvent.pointerDown(screen.getByText('row'), { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { pointerId: 1, clientX: 200, clientY: 100 });
    expect(panel.dataset.dragging).toBe('true');
  });
});

describe('useFloatingPlacement drag lifecycle', () => {
  it('keeps dragging from moves the panel never sees, and ends on a release off it', () => {
    const { panel } = renderPanel(<Harness />);
    fireEvent.pointerDown(panel, { pointerId: 1, buttons: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(document.body, { pointerId: 1, buttons: 1, clientX: 200, clientY: 180 });
    expect(panel.dataset.dragging).toBe('true');
    expect(panel.style.left).toBe('100px');
    fireEvent.pointerUp(document.body, { pointerId: 1, clientX: 200, clientY: 180 });
    expect(panel.dataset.dragging).toBeUndefined();
    fireEvent.pointerMove(document.body, { pointerId: 1, buttons: 1, clientX: 300, clientY: 180 });
    expect(panel.style.left).toBe('100px');
  });

  // The other half of the rule — a detached origin does cancel — is owned by
  // pointerSession.test.ts, which exercises it without React in the way.
  it('keeps dragging when capture is lost and the panel is still in the document', () => {
    const { panel } = renderPanel(<Harness />);
    fireEvent.pointerDown(panel, { pointerId: 1, buttons: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(document.body, { pointerId: 1, buttons: 1, clientX: 200, clientY: 180 });
    expect(panel.style.left).toBe('100px');
    // Chrome releases capture a beat before it delivers pointerup, so ending
    // here throws away a release that has already been dispatched.
    fireEvent(panel, new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    expect(panel.dataset.dragging).toBe('true');
    fireEvent.pointerMove(document.body, { pointerId: 1, buttons: 1, clientX: 300, clientY: 180 });
    expect(panel.style.left).toBe('200px');
  });

  it('reads a move with nothing held as the release that never arrived', () => {
    const onChange = vi.fn();
    const { panel } = renderPanel(<Harness onChange={onChange} />);
    fireEvent.pointerDown(panel, { pointerId: 1, buttons: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(document.body, { pointerId: 1, buttons: 1, clientX: 200, clientY: 180 });
    expect(panel.dataset.dragging).toBe('true');
    fireEvent.pointerMove(document.body, { pointerId: 1, buttons: 0, clientX: 300, clientY: 180 });
    expect(panel.dataset.dragging).toBeUndefined();
    expect(panel.style.left).toBe('100px');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('captures the pointer only once the press crosses the drag threshold', () => {
    // A proxy for the real symptom: jsdom's setPointerCapture never retargets,
    // so the child click a capture-on-press would swallow cannot be observed.
    const captured: number[] = [];
    Element.prototype.setPointerCapture = (id: number) => {
      captured.push(id);
    };
    const { panel } = renderPanel(<Harness />);
    fireEvent.pointerDown(panel, { pointerId: 7, buttons: 1, clientX: 100, clientY: 100 });
    expect(captured).toEqual([]);
    fireEvent.pointerMove(document.body, { pointerId: 7, buttons: 1, clientX: 140, clientY: 100 });
    expect(captured).toEqual([7]);
  });

  it('releases the capture it took when the drag ends', () => {
    const released: number[] = [];
    Element.prototype.setPointerCapture = () => {};
    const realRelease = Element.prototype.releasePointerCapture;
    Element.prototype.releasePointerCapture = (id: number) => {
      released.push(id);
    };
    try {
      const { panel } = renderPanel(<Harness />);
      fireEvent.pointerDown(panel, { pointerId: 7, buttons: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(document.body, { pointerId: 7, buttons: 1, clientX: 140, clientY: 100 });
      fireEvent.pointerUp(document.body, { pointerId: 7, clientX: 140, clientY: 100 });
      expect(released).toContain(7);
    } finally {
      Element.prototype.releasePointerCapture = realRelease;
    }
  });

  it('drops its document listeners when the panel unmounts mid-drag', () => {
    const added: string[] = [];
    const removed: string[] = [];
    const realAdd = document.addEventListener.bind(document);
    const realRemove = document.removeEventListener.bind(document);
    const addSpy = vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, opts) => {
      added.push(String(type));
      realAdd(type as never, listener as never, opts as never);
    });
    const removeSpy = vi.spyOn(document, 'removeEventListener').mockImplementation((type, listener, opts) => {
      removed.push(String(type));
      realRemove(type as never, listener as never, opts as never);
    });
    try {
      const { panel, unmount } = renderPanel(<Harness />);
      fireEvent.pointerDown(panel, { pointerId: 1, buttons: 1, clientX: 100, clientY: 100 });
      expect(added).toContain('pointermove');
      unmount();
      expect(removed).toContain('pointermove');
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });
});

describe('a host that commits the placement a tick later', () => {
  function Deferred({ onDrawn }: { onDrawn: (left: string) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [placement, setPlacement] = useState<FloatingPlacement>({ x: 0, y: 0, anchor: 'top-left' });
    const { style, startDrag } = useFloatingPlacement({
      panelRef: ref,
      placement,
      onPlacementChange: (next) => void setTimeout(() => setPlacement(next), 0),
    });
    onDrawn(String(style.left));
    return <div data-panel="" onPointerDown={startDrag} ref={ref} style={style} />;
  }

  it('keeps the panel where it was dropped until the new placement arrives, never drawing the old spot', async () => {
    const drawn: string[] = [];
    const { panel } = renderPanel(<Deferred onDrawn={(left) => drawn.push(left)} />);
    expect(panel.style.left).toBe('12px');
    fireEvent.pointerDown(panel, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { pointerId: 1, clientX: 200, clientY: 180 });
    expect(panel.style.left).toBe('100px');
    drawn.length = 0;
    fireEvent.pointerUp(panel, { pointerId: 1, clientX: 200, clientY: 180 });
    expect(panel.style.left).toBe('100px');
    await act(() => new Promise((done) => setTimeout(done, 5)));
    expect(panel.style.left).toBe('100px');
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn).not.toContain('12px');
  });

  it('lets go of the dropped spot at the next press when no new placement ever arrives', () => {
    const fixed: FloatingPlacement = { x: 0, y: 0, anchor: 'top-left' };
    function Refusing() {
      const ref = useRef<HTMLDivElement>(null);
      const { style, startDrag } = useFloatingPlacement({ panelRef: ref, placement: fixed, onPlacementChange: () => {} });
      return <div data-panel="" onPointerDown={startDrag} ref={ref} style={style} />;
    }
    const { panel } = renderPanel(<Refusing />);
    fireEvent.pointerDown(panel, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { pointerId: 1, clientX: 200, clientY: 180 });
    fireEvent.pointerUp(panel, { pointerId: 1, clientX: 200, clientY: 180 });
    expect(panel.style.left).toBe('100px');
    fireEvent.pointerDown(panel, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(panel.style.left).toBe('12px');
    fireEvent.pointerUp(panel, { pointerId: 1, clientX: 100, clientY: 100 });
  });
});
