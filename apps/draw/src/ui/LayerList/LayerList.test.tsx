import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { LayerList } from './LayerList';

const ITEMS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

describe('LayerList', () => {
  it('renders one row per item with its label', () => {
    render(
      <LayerList items={ITEMS} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} />
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  it('click on row fires onSelect with [id]', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={[]} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Beta'), { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Beta'), { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
  });

  it('shift-click on unselected row adds it to selection', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={['a']} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Gamma'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Gamma'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('shift-click on already-selected row removes it', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={['a', 'c']} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Alpha'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Alpha'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['c']);
  });

  it('empty items prop renders the empty-state node', () => {
    render(
      <LayerList items={[]} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} empty={<span>No layers</span>} />
    );
    expect(screen.getByText('No layers')).toBeTruthy();
  });

  it('selected row has the selected class', () => {
    const { container } = render(
      <LayerList items={ITEMS} selectedIds={['b']} onSelect={() => {}} onReorder={() => {}} />
    );
    const rows = container.querySelectorAll('[data-row-index]');
    expect(rows[1].className).toMatch(/selected/);
  });

  it('drops cannot land at or below a locked row', () => {
    const onReorder = vi.fn();
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'page', label: 'Page', locked: true },
    ];
    // Stub getBoundingClientRect so the hook's vertical math is deterministic.
    // Each row is 28px tall starting at y=0.
    const origGBR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute('data-row-index')) {
        const i = Number(this.getAttribute('data-row-index'));
        return { top: i * 28, bottom: (i + 1) * 28, left: 0, right: 100, width: 100, height: 28, x: 0, y: i * 28, toJSON: () => ({}) } as DOMRect;
      }
      return origGBR.call(this);
    };
    try {
      render(
        <LayerList items={items} selectedIds={[]} onSelect={() => {}} onReorder={onReorder} />
      );
      const alpha = screen.getByText('Alpha');
      // Drag Alpha; release at y=1000 (well past the Page row at y=56..84).
      fireEvent.pointerDown(alpha, { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
      fireEvent.pointerMove(alpha, { clientX: 0, clientY: 1000, pointerId: 1, isPrimary: true });
      fireEvent.pointerUp(alpha, { clientX: 0, clientY: 1000, pointerId: 1, isPrimary: true });
      // Locked row sits at index 2; the deepest legal drop is index 2 (just above Page).
      expect(onReorder).toHaveBeenCalledWith(['a'], 2);
    } finally {
      Element.prototype.getBoundingClientRect = origGBR;
    }
  });

  it('locked row cannot initiate a drag', () => {
    const onReorder = vi.fn();
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'page', label: 'Page', locked: true },
    ];
    const { container } = render(
      <LayerList items={items} selectedIds={[]} onSelect={() => {}} onReorder={onReorder} />
    );
    const pageRow = screen.getByText('Page');
    fireEvent.pointerDown(pageRow, { clientX: 0, clientY: 60, pointerId: 1, isPrimary: true });
    fireEvent.pointerMove(pageRow, { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    // No drop indicator should appear because no drag engaged.
    const indicator = container.querySelector('[class*="dropIndicator"]');
    expect(indicator).toBeNull();
    fireEvent.pointerUp(pageRow, { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('shift-click on a locked row is exclusive (no combine)', () => {
    const onSelect = vi.fn();
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'page', label: 'Page', locked: true },
    ];
    render(
      <LayerList items={items} selectedIds={['a']} onSelect={onSelect} onReorder={() => {}} />
    );
    fireEvent.pointerDown(screen.getByText('Page'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Page'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['page']);
  });

  it('shift-click on a regular row strips locked ids from selection', () => {
    const onSelect = vi.fn();
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'page', label: 'Page', locked: true },
    ];
    render(
      <LayerList items={items} selectedIds={['page']} onSelect={onSelect} onReorder={() => {}} />
    );
    fireEvent.pointerDown(screen.getByText('Beta'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Beta'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
  });

  it('locked rows emit data-locked="true"', () => {
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'page', label: 'Page', locked: true },
    ];
    const { container } = render(
      <LayerList items={items} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} />
    );
    const rows = container.querySelectorAll('[data-row-index]');
    expect(rows[0].getAttribute('data-locked')).toBeNull();
    expect(rows[1].getAttribute('data-locked')).toBe('true');
  });

  it('places the drop indicator on the seam of the rendered rows, not a fixed row height', () => {
    // Rows 32px tall with a 2px gap — not the 24px the default density gives.
    const ROW = 32;
    const GAP = 2;
    const origGBR = Element.prototype.getBoundingClientRect;
    const origTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!;
    const origHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
    const indexOf = (el: Element) => Number(el.getAttribute('data-row-index'));
    Element.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute('data-row-index')) {
        const top = indexOf(this) * (ROW + GAP);
        return { top, bottom: top + ROW, left: 0, right: 100, width: 100, height: ROW, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      }
      return origGBR.call(this);
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get() { return this.hasAttribute('data-row-index') ? indexOf(this) * (ROW + GAP) : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() { return this.hasAttribute('data-row-index') ? ROW : 0; },
    });
    try {
      const { container } = render(
        <LayerList items={ITEMS} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} />
      );
      const alpha = screen.getByText('Alpha');
      fireEvent.pointerDown(alpha, { clientX: 0, clientY: 5, pointerId: 1, isPrimary: true });
      // Below every row: the drop lands after the last one.
      fireEvent.pointerMove(alpha, { clientX: 0, clientY: 500, pointerId: 1, isPrimary: true });
      const indicator = container.querySelector<HTMLElement>('[class*="dropIndicator"]');
      expect(indicator).not.toBeNull();
      expect(indicator!.style.top).toBe(`${2 * (ROW + GAP) + ROW - 1}px`);
      // Inside Gamma: the drop lands above it, in the middle of the gap
      // between Beta and Gamma, less half the 2px bar.
      fireEvent.pointerMove(alpha, { clientX: 0, clientY: 2 * (ROW + GAP) + 5, pointerId: 1, isPrimary: true });
      const moved = container.querySelector<HTMLElement>('[class*="dropIndicator"]');
      expect(moved!.style.top).toBe(`${(ROW + GAP) + ROW + GAP / 2 - 1}px`);
      fireEvent.pointerUp(alpha, { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    } finally {
      Element.prototype.getBoundingClientRect = origGBR;
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', origTop);
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origHeight);
    }
  });
});
