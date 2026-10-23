import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { BarLayout, type BarOrientation } from '../Bar';
import { ToolbarDock } from './ToolbarDock';
import type { DockBar, DockSpec, ToolbarLayout } from './layout';

// jsdom lays nothing out. The dock is 800 x 600. The top dock stacks rows 30 px deep from y 0 and the bottom one from
// y 500, each bar 100 px long along x from 0; an empty dock's strip is the dock's last 24 px; a floating bar is
// 100 x 30 wherever the dock put it.
const GEO: Record<string, number> = { top: 0, bottom: 500 };
const rect = (left: number, top: number, w: number, h: number) =>
  ({ x: left, y: top, left, top, right: left + w, bottom: top + h, width: w, height: h, toJSON: () => {} }) as DOMRect;
const EMPTY = rect(0, 0, 0, 0);
const px = (el: Element, name: string) => parseFloat((el as HTMLElement).style.getPropertyValue(name)) || 0;
const realRect = Element.prototype.getBoundingClientRect;
const realRO = globalThis.ResizeObserver;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box(this: Element) {
    if (this.matches('[data-dock-layer]')) return rect(0, 0, 800, 600);
    if (this.matches('[data-dock-floating]')) return rect(px(this, '--dock-float-x'), px(this, '--dock-float-y'), 100, 30);
    if (this.matches('[data-dock-empty]')) return this.getAttribute('data-dock-edge') === 'bottom' ? rect(0, 576, 800, 24) : rect(0, 0, 800, 24);
    const dock = this.closest('[data-dock]');
    const cross = dock && GEO[dock.getAttribute('data-dock')!];
    if (!dock || cross === undefined || cross === null || !this.matches('[data-dock], [data-dock-row], [data-dock-bar], [data-dock-held]')) return EMPTY;
    const rows = dock.querySelectorAll(':scope > [data-dock-row]').length;
    const row = this.closest('[data-dock-row]');
    if (!row) return rect(0, cross, 600, 30 * rows);
    const i = Number(row.getAttribute('data-dock-row'));
    if (this === row) return rect(0, cross + 30 * i, 600, 30);
    const j = Array.from(row.children).indexOf(this);
    return rect(100 * j, cross + 30 * i, 100, 30);
  };
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      const [width, height] = target.hasAttribute('data-dock-layer') ? [800, 600] : [100, 30];
      this.#cb([{ target, contentRect: { width, height } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  globalThis.ResizeObserver = realRO;
});
afterEach(cleanup);

const docks: DockSpec[] = [
  { id: 'top', edge: 'top' },
  { id: 'bottom', edge: 'bottom' },
];

const ran = vi.fn();
function bar(id: string, extra: Partial<DockBar> = {}): DockBar {
  const label = id[0]!.toUpperCase() + id.slice(1);
  return {
    id,
    label,
    docks: ['top', 'bottom'],
    float: true,
    render: (orientation: BarOrientation) => (
      <BarLayout
        label={label}
        lead="label"
        orientation={orientation}
        nodes={[{ kind: 'cell', path: `${id}.go`, content: <button type="button" onClick={() => ran(id)}>{`${label} go`}</button> }]}
        cells={() => []}
        row={() => null}
      />
    ),
    ...extra,
  };
}
const bars = [bar('file'), bar('view'), bar('shape'), bar('pin', { docks: ['top'], float: false })];

function Harness({ initial, onChange, later }: { initial: ToolbarLayout; onChange: (l: ToolbarLayout) => void; later?: boolean }) {
  const [layout, setLayout] = useState(initial);
  // Only the bars the starting layout places, so none is added at the end of a dock.
  const [offered] = useState(() => {
    const placed = [...Object.values(initial.docks).flat(2), ...Object.keys(initial.floating)];
    return bars.filter((b) => placed.includes(b.id));
  });
  return (
    <ToolbarDock
      docks={docks}
      bars={offered}
      layout={layout}
      movable
      onLayoutChange={(next) => {
        onChange(next);
        if (later) setTimeout(() => setLayout(next), 0);
        else setLayout(next);
      }}
    />
  );
}

const start = (top: string[][], floating: ToolbarLayout['floating'] = {}, bottom: string[][] = []): ToolbarLayout => ({ docks: { top, bottom }, floating });
const setup = (initial: ToolbarLayout, later?: boolean) => {
  const onChange = vi.fn<(l: ToolbarLayout) => void>();
  render(<Harness initial={initial} onChange={onChange} later={later} />);
  return onChange;
};

const handle = (label: string) => screen.getByRole('button', { name: `Move ${label} toolbar` });
const floating = (id: string) => document.querySelector(`[data-dock-floating][data-dock-bar="${id}"]`);
const pt = (x: number, y: number) => ({ pointerId: 1, button: 0, buttons: 1, pointerType: 'mouse', clientX: x, clientY: y });
function press(el: Element, from: [number, number], path: [number, number][]) {
  fireEvent.pointerDown(el, pt(...from));
  for (const p of path) fireEvent.pointerMove(document, pt(...p));
}
const release = (at: [number, number]) => fireEvent.pointerUp(document, { ...pt(...at), buttons: 0 });

describe('tearing a bar off its dock', () => {
  it('lifts the bar past 24 px across its row, floats it under the pointer, and writes where it is let go', () => {
    const onChange = setup(start([['file', 'view']]));
    press(handle('File'), [50, 15], [[50, 30], [50, 50]]);
    expect(floating('file')).toBeNull();
    fireEvent.pointerMove(document, pt(300, 200));
    expect(floating('file')).not.toBeNull();
    expect(floating('file')).toHaveAttribute('data-dock-dragging');
    expect(document.querySelector('[data-dock-held="file"]')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    release([300, 200]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toEqual({ docks: { top: [['view']], bottom: [] }, floating: { file: { x: 250, y: 185, anchor: null, orientation: 'horizontal' } } });
    expect(floating('file')).not.toBeNull();
    expect(floating('file')).not.toHaveAttribute('data-dock-dragging');
  });

  it('does not float a bar dragged less than 24 px across its row', () => {
    const onChange = setup(start([['file', 'view']]));
    press(handle('File'), [50, 15], [[50, 30], [50, 50]]);
    release([50, 50]);
    expect(floating('file')).toBeNull();
    expect(onChange.mock.calls[0]![0]).toEqual({ docks: { top: [['view'], ['file']], bottom: [] }, floating: {} });
  });

  it('never tears a bar without float', () => {
    const onChange = setup(start([['pin', 'file']]));
    press(handle('Pin'), [50, 15], [[50, 30], [300, 200]]);
    expect(floating('pin')).toBeNull();
    release([300, 200]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is caught by the corner it is let go near', () => {
    const onChange = setup(start([['file', 'view']]));
    press(handle('File'), [50, 15], [[50, 30], [300, 200], [738, 27]]);
    release([738, 27]);
    expect(onChange.mock.calls[0]![0].floating.file).toEqual({ x: 688, y: 12, anchor: 'top-right', orientation: 'horizontal' });
  });

  it('goes back into its dock when brought within 24 px of a row again', () => {
    const onChange = setup(start([['file', 'view', 'shape']]));
    press(handle('File'), [50, 15], [[50, 30], [300, 200], [260, 20]]);
    expect(floating('file')).toBeNull();
    expect(document.querySelector('[data-dock-bar="shape"]')).toHaveAttribute('data-dock-drop', 'after');
    release([260, 20]);
    expect(onChange.mock.calls[0]![0]).toEqual({ docks: { top: [['view', 'shape', 'file']], bottom: [] }, floating: {} });
  });

  it('puts everything back on Escape, and the release after it calls nothing', () => {
    const onChange = setup(start([['file', 'view']]));
    press(handle('File'), [50, 15], [[50, 30], [300, 200]]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(floating('file')).toBeNull();
    expect(document.querySelector('[data-dock-held]')).toBeNull();
    release([300, 200]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stays where it was let go until a host that commits a tick later sends the layout', async () => {
    const onChange = setup(start([['file', 'view']]), true);
    press(handle('File'), [50, 15], [[50, 30], [300, 200]]);
    release([300, 200]);
    expect(floating('file')).not.toBeNull();
    expect(document.querySelector('[data-dock-row] [data-dock-bar="file"]')).toBeNull();
    await act(() => new Promise((done) => setTimeout(done, 5)));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(floating('file')).not.toBeNull();
    expect((floating('file') as HTMLElement).style.getPropertyValue('--dock-float-x')).toBe('250px');
  });
});

describe('a floating bar', () => {
  const afloat = { file: { x: 300, y: 200, anchor: null, orientation: 'horizontal' as const } };

  it('is drawn in the floating layer where its placement says', () => {
    setup(start([['view']], afloat));
    expect((floating('file') as HTMLElement).style.getPropertyValue('--dock-float-x')).toBe('300px');
    expect(document.querySelector('[data-dock-row] [data-dock-bar="file"]')).toBeNull();
  });

  it('docks again when dropped on a dock row, marking where it lands', () => {
    const onChange = setup(start([['view', 'shape']], afloat));
    press(handle('File'), [350, 215], [[340, 215], [120, 15]]);
    expect(floating('file')).not.toBeNull();
    expect(document.querySelector('[data-dock-bar="shape"]')).toHaveAttribute('data-dock-drop', 'before');
    release([120, 15]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toEqual({ docks: { top: [['view', 'file', 'shape']], bottom: [] }, floating: {} });
    expect(floating('file')).toBeNull();
  });

  it('docks on the strip a drag shows along an empty dock', () => {
    const onChange = setup(start([['view']], afloat));
    expect(document.querySelector('[data-dock-empty]')).toBeNull();
    press(handle('File'), [350, 215], [[350, 250], [400, 590]]);
    expect(document.querySelector('[data-dock-empty="bottom"]')).toHaveAttribute('data-dock-drop', 'row');
    release([400, 590]);
    expect(onChange.mock.calls[0]![0]).toEqual({ docks: { top: [['view']], bottom: [['file']] }, floating: {} });
    expect(document.querySelector('[data-dock-empty]')).toBeNull();
  });

  it('moves to where it is let go over open space', () => {
    const onChange = setup(start([['view']], afloat));
    press(handle('File'), [350, 215], [[360, 215], [450, 315]]);
    release([450, 315]);
    expect(onChange.mock.calls[0]![0].floating.file).toEqual({ x: 400, y: 300, anchor: null, orientation: 'horizontal' });
  });

  it('clicks its buttons on a plain press', () => {
    ran.mockClear();
    const onChange = setup(start([['view']], afloat));
    const go = screen.getByRole('button', { name: 'File go' });
    fireEvent.pointerDown(go, pt(360, 215));
    release([360, 215]);
    fireEvent.click(go);
    expect(ran).toHaveBeenCalledWith('file');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Alt+Enter on a handle', () => {
  const key = (el: Element) => act(() => void fireEvent.keyDown(el, { key: 'Enter', altKey: true }));

  it('floats a docked bar where it is drawn, and docks it again at the end of its dock’s last row', () => {
    const onChange = setup(start([['view', 'file'], ['shape']]));
    handle('File').focus();
    key(handle('File'));
    expect(onChange.mock.calls[0]![0]).toEqual({ docks: { top: [['view'], ['shape']], bottom: [] }, floating: { file: { x: 100, y: 0, anchor: null, orientation: 'horizontal' } } });
    expect(floating('file')).not.toBeNull();
    expect(document.activeElement).toBe(handle('File'));
    expect(document.querySelector('[data-dock-announce]')).toHaveTextContent('File toolbar floating');
    key(handle('File'));
    expect(onChange.mock.calls[1]![0]).toEqual({ docks: { top: [['view'], ['shape', 'file']], bottom: [] }, floating: {} });
    expect(document.activeElement).toBe(handle('File'));
    expect(document.querySelector('[data-dock-announce]')).toHaveTextContent('File toolbar docked, row 2, position 2 of 2');
  });

  it('is offered, and does anything, only on a bar that may float', () => {
    const onChange = setup(start([['pin', 'file']]));
    expect(handle('File').getAttribute('aria-keyshortcuts')).toContain('Alt+Enter');
    expect(handle('Pin').getAttribute('aria-keyshortcuts')).not.toContain('Alt+Enter');
    key(handle('Pin'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
