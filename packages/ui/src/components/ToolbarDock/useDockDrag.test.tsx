import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { PrefOrder } from '@weasel-js/prefs';
import { BarLayout, BarMenu, type BarNode, type BarOrientation } from '../Bar';
import { ToolbarDock } from './ToolbarDock';
import type { DockBar, DockSpec, ToolbarLayout } from './layout';

// jsdom lays nothing out. Each dock stacks rows 30 px deep across its edge, and sets each bar 100 px long along the
// row: top from y 0 and bottom from y 500 along x from 0, left from x 0 along y from 100.
const GEO: Record<string, { vertical: boolean; cross: number; along: number }> = {
  top: { vertical: false, cross: 0, along: 0 },
  bottom: { vertical: false, cross: 500, along: 0 },
  left: { vertical: true, cross: 0, along: 100 },
};
const EMPTY = { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => {} } as DOMRect;
const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box(this: Element) {
    const dock = this.closest('[data-dock]');
    const geo = dock && GEO[dock.getAttribute('data-dock')!];
    if (!dock || !geo || !(this.matches('[data-dock], [data-dock-row], [data-dock-bar]'))) return EMPTY;
    const rows = dock.querySelectorAll(':scope > [data-dock-row]').length;
    const row = this.closest('[data-dock-row]');
    const i = row ? Number(row.getAttribute('data-dock-row')) : 0;
    let [c0, c1] = row ? [geo.cross + 30 * i, geo.cross + 30 * (i + 1)] : [geo.cross, geo.cross + 30 * rows];
    let [a0, a1] = [geo.along, geo.along + 600];
    if (this.matches('[data-dock-bar]')) {
      const j = Array.from(row!.querySelectorAll(':scope > [data-dock-bar]')).indexOf(this);
      [a0, a1] = [geo.along + 100 * j, geo.along + 100 * (j + 1)];
    }
    if (geo.vertical) [a0, a1, c0, c1] = [c0, c1, a0, a1];
    return { x: a0, y: c0, left: a0, top: c0, right: a1, bottom: c1, width: a1 - a0, height: c1 - c0, toJSON: () => {} } as DOMRect;
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});
afterEach(cleanup);

const docks: DockSpec[] = [
  { id: 'top', edge: 'top' },
  { id: 'left', edge: 'left' },
  { id: 'bottom', edge: 'bottom' },
];

const ran = vi.fn();
function bar(id: string, extra: Partial<DockBar> = {}, nodes?: readonly BarNode[], onReorder?: (o: PrefOrder) => void): DockBar {
  const label = id[0]!.toUpperCase() + id.slice(1);
  return {
    id,
    label,
    docks: ['top', 'left', 'bottom'],
    render: (orientation: BarOrientation) => (
      <BarLayout
        label={label}
        lead="label"
        orientation={orientation}
        nodes={nodes ?? [{ kind: 'cell', path: `${id}.go`, content: <button type="button" onClick={() => ran(id)}>{`${label} go`}</button> }]}
        cells={() => []}
        row={() => null}
        onReorder={onReorder}
      />
    ),
    ...extra,
  };
}

const bars = [bar('file'), bar('view'), bar('shape')];
const withPin = [...bars, bar('pin', { docks: ['top'] })];

function Harness({ initial, onChange, with: offered = bars }: { initial: ToolbarLayout; onChange: (l: ToolbarLayout) => void; with?: DockBar[] }) {
  const [layout, setLayout] = useState(initial);
  return (
    <ToolbarDock
      docks={docks}
      bars={offered}
      layout={layout}
      movable
      onLayoutChange={(next) => {
        onChange(next);
        setLayout(next);
      }}
    />
  );
}

const start = (top: string[][], left: string[][] = [], bottom: string[][] = []): ToolbarLayout => ({ docks: { top, left, bottom }, floating: {} });

const setup = (initial: ToolbarLayout, offered?: DockBar[]) => {
  const onChange = vi.fn<(l: ToolbarLayout) => void>();
  render(<Harness initial={initial} onChange={onChange} with={offered} />);
  return onChange;
};

const handle = (label: string) => screen.getByRole('button', { name: `Move ${label} toolbar` });
const wrapper = (id: string) => document.querySelector(`[data-dock-bar="${id}"]`)!;
const pt = (x: number, y: number) => ({ pointerId: 1, button: 0, buttons: 1, pointerType: 'mouse', clientX: x, clientY: y });

/** Presses `el` at `from`, and moves through `path` without releasing. */
function press(el: Element, from: [number, number], path: [number, number][]) {
  fireEvent.pointerDown(el, pt(...from));
  for (const p of path) fireEvent.pointerMove(document, pt(...p));
}
const release = (at: [number, number]) => fireEvent.pointerUp(document, { ...pt(...at), buttons: 0 });

describe('dragging a bar by its handle', () => {
  it('reorders a bar within its row, marking the dragged bar and where it lands until the release', () => {
    const onChange = setup(start([['file', 'view', 'shape']]));
    press(handle('File'), [50, 15], [[60, 15], [260, 15]]);
    expect(wrapper('file')).toHaveAttribute('data-dock-dragging');
    expect(wrapper('shape')).toHaveAttribute('data-dock-drop', 'after');
    expect(onChange).not.toHaveBeenCalled();
    release([260, 15]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].docks).toEqual({ top: [['view', 'shape', 'file']], left: [], bottom: [] });
    expect(document.querySelector('[data-dock-dragging], [data-dock-drop]')).toBeNull();
  });

  it('marks the bar it lands before', () => {
    setup(start([['file', 'view', 'shape']]));
    press(handle('Shape'), [250, 15], [[240, 15], [140, 15]]);
    expect(wrapper('view')).toHaveAttribute('data-dock-drop', 'before');
    release([140, 15]);
  });

  it('moves a bar onto another dock it may sit in', () => {
    const onChange = setup(start([['file', 'view']], [['shape']]));
    press(handle('View'), [150, 15], [[150, 30], [15, 180]]);
    expect(wrapper('shape')).toHaveAttribute('data-dock-drop', 'after');
    release([15, 180]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].docks).toEqual({ top: [['file']], left: [['shape', 'view']], bottom: [] });
  });

  it('moves a bar to another row of its dock', () => {
    const onChange = setup(start([['file', 'view'], ['shape']]));
    press(handle('File'), [50, 15], [[50, 25], [150, 45]]);
    release([150, 45]);
    expect(onChange.mock.calls[0]![0].docks.top).toEqual([['view'], ['shape', 'file']]);
  });

  it('makes a new row below the last row, within half a row of it', () => {
    const onChange = setup(start([['file', 'view'], ['shape']]));
    press(handle('File'), [50, 15], [[50, 30], [50, 70]]);
    expect(document.querySelector('[data-dock="top"] [data-dock-drop="row"]')).not.toBeNull();
    release([50, 70]);
    expect(onChange.mock.calls[0]![0].docks.top).toEqual([['view'], ['shape'], ['file']]);
  });

  it('makes a new row above the first row, within half a row of it', () => {
    const onChange = setup(start([['file', 'view']], [], [['shape']]));
    press(handle('File'), [50, 15], [[50, 30], [50, 490]]);
    expect(document.querySelector('[data-dock="bottom"] [data-dock-drop="row"]')).not.toBeNull();
    release([50, 490]);
    expect(onChange.mock.calls[0]![0].docks).toEqual({ top: [['view']], left: [], bottom: [['file'], ['shape']] });
  });

  it('refuses a dock the bar may not sit in, and marks it unavailable for the drag', () => {
    const onChange = setup(start([['pin', 'file']], [['shape']]), withPin);
    press(handle('Pin'), [50, 15], [[50, 30], [15, 180]]);
    expect(document.querySelector('[data-dock="left"]')).toHaveAttribute('data-dock-unavailable');
    expect(document.querySelector('[data-dock="top"]')).not.toHaveAttribute('data-dock-unavailable');
    expect(document.querySelector('[data-dock-drop]')).toBeNull();
    release([15, 180]);
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('[data-dock-unavailable]')).toBeNull();
  });

  it('calls nothing for a drop where the bar already is', () => {
    const onChange = setup(start([['file', 'view']]));
    press(handle('File'), [50, 15], [[60, 15], [70, 15]]);
    release([70, 15]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('restores everything on Escape, and the release after it calls nothing', () => {
    const onChange = setup(start([['file', 'view', 'shape']]));
    press(handle('File'), [50, 15], [[60, 15], [260, 15]]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('[data-dock-dragging], [data-dock-drop]')).toBeNull();
    release([260, 15]);
    expect(onChange).not.toHaveBeenCalled();
  });

  // A proxy: jsdom has no pointer capture, so it cannot show a capture at the press retargeting the release and
  // killing the click on the bar. What it can show is that nothing asked for one.
  it('captures nothing at the press, only once the press is a drag', () => {
    const capture = vi.fn();
    Element.prototype.setPointerCapture = capture;
    try {
      setup(start([['file', 'view']]));
      fireEvent.pointerDown(handle('File'), pt(50, 15));
      expect(capture).not.toHaveBeenCalled();
      fireEvent.pointerMove(document, pt(90, 15));
      expect(capture).toHaveBeenCalledTimes(1);
      release([90, 15]);
    } finally {
      delete (Element.prototype as Partial<Element>).setPointerCapture;
    }
  });
});

describe('moving a bar from its handle with Alt+arrows', () => {
  const key = (el: Element, k: string) => act(() => void fireEvent.keyDown(el, { key: k, altKey: true }));

  it('moves one slot along its row, keeping focus on the handle and announcing where it landed', () => {
    const onChange = setup(start([['file', 'view', 'shape']]));
    handle('File').focus();
    key(handle('File'), 'ArrowRight');
    expect(onChange.mock.calls[0]![0].docks.top).toEqual([['view', 'file', 'shape']]);
    expect(document.activeElement).toBe(handle('File'));
    const say = document.querySelector('[data-dock-announce]');
    expect(say).toHaveTextContent('File toolbar, row 1, position 2 of 3');
    expect(say).toHaveAttribute('aria-live', 'polite');
    expect(say).toHaveAttribute('aria-atomic', 'true');
    // A role of status would collide with an app's own status bar.
    expect(say).not.toHaveAttribute('role');
    key(handle('File'), 'ArrowLeft');
    expect(onChange.mock.calls[1]![0].docks.top).toEqual([['file', 'view', 'shape']]);
  });

  it('does nothing past a row’s end', () => {
    const onChange = setup(start([['file', 'view', 'shape']]));
    key(handle('File'), 'ArrowLeft');
    key(handle('Shape'), 'ArrowRight');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves to the next and previous row, at the same index clamped', () => {
    const onChange = setup(start([['file', 'view'], ['shape']]));
    handle('View').focus();
    key(handle('View'), 'ArrowDown');
    expect(onChange.mock.calls[0]![0].docks.top).toEqual([['file'], ['shape', 'view']]);
    expect(document.activeElement).toBe(handle('View'));
    expect(document.querySelector('[data-dock-announce]')).toHaveTextContent('View toolbar, row 2, position 2 of 2');
    key(handle('View'), 'ArrowUp');
    expect(onChange.mock.calls[1]![0].docks.top).toEqual([['file', 'view'], ['shape']]);
  });

  it('moves past the last row into the first row of the next dock it may sit in, at that row’s end', () => {
    const onChange = setup(start([['file', 'view']], [['shape'], ['pin2']], []), [...bars, bar('pin2', { docks: ['left'] })]);
    handle('File').focus();
    key(handle('File'), 'ArrowDown');
    expect(onChange.mock.calls[0]![0].docks).toEqual({ top: [['view']], left: [['shape', 'file'], ['pin2']], bottom: [] });
    expect(document.activeElement).toBe(handle('File'));
  });

  it('moves past the first row into the last row of the previous dock it may sit in, at that row’s end', () => {
    const onChange = setup(start([['file'], ['view']], [['shape']], []));
    handle('Shape').focus();
    key(handle('Shape'), 'ArrowUp');
    expect(onChange.mock.calls[0]![0].docks).toEqual({ top: [['file'], ['view', 'shape']], left: [], bottom: [] });
    expect(document.activeElement).toBe(handle('Shape'));
  });

  it('skips a dock the bar may not sit in', () => {
    const onChange = setup(start([['file', 'pin3']], [['shape']], [['view']]), [...bars, bar('pin3', { docks: ['top', 'bottom'] })]);
    key(handle('Pin3'), 'ArrowDown');
    expect(onChange.mock.calls[0]![0].docks).toEqual({ top: [['file']], left: [['shape']], bottom: [['view', 'pin3']] });
  });

  it('does nothing past the last dock the bar may sit in', () => {
    const onChange = setup(start([['file', 'pin']], [['shape']]), withPin);
    key(handle('Pin'), 'ArrowDown');
    key(handle('Pin'), 'ArrowUp');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves the bar, not an item, from the handle; and an item, not the bar, from the item', () => {
    const items = vi.fn<(o: PrefOrder) => void>();
    const nodes: BarNode[] = ['a', 'b'].map((k) => ({ kind: 'cell', path: k, content: <button type="button">{k}</button> }));
    const onChange = setup(start([['tools', 'view']]), [bar('tools', {}, nodes, items), bar('view')]);
    key(handle('Tools'), 'ArrowRight');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(items).not.toHaveBeenCalled();
    key(screen.getByRole('button', { name: 'a' }), 'ArrowRight');
    expect(items).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('a bar drawn as nothing', () => {
  function Nothing() {
    return null;
  }
  const ghost = bar('ghost', { render: () => null });
  const nil = bar('nil', { render: () => <Nothing /> });
  const offered = [...bars, ghost, nil];
  const row = [['file', 'ghost', 'view', 'nil', 'shape']];

  it('gets no slot when its render is null, and an empty one when what it renders draws nothing', () => {
    setup(start(row), offered);
    expect(document.querySelector('[data-dock-bar="ghost"]')).toBeNull();
    expect(document.querySelector('[data-dock-bar="nil"]')).toBeEmptyDOMElement();
  });

  it('keeps its place while a drag reorders the bars drawn round it', () => {
    const onChange = setup(start(row), offered);
    press(handle('File'), [50, 15], [[60, 15], [160, 15]]);
    expect(wrapper('shape')).toHaveAttribute('data-dock-drop', 'before');
    release([160, 15]);
    expect(onChange.mock.calls[0]![0].docks.top).toEqual([['ghost', 'view', 'nil', 'file', 'shape']]);
  });

  it('is stepped over by Alt+arrows, and left out of what a move announces', () => {
    const onChange = setup(start(row), offered);
    act(() => void fireEvent.keyDown(handle('File'), { key: 'ArrowRight', altKey: true }));
    expect(onChange.mock.calls[0]![0].docks.top).toEqual([['ghost', 'view', 'nil', 'file', 'shape']]);
    expect(document.querySelector('[data-dock-announce]')).toHaveTextContent('File toolbar, row 1, position 2 of 3');
  });
});

describe('a bar drawn as a menu button', () => {
  const MENU = { name: 'Tools', as: 'menu', children: {} } as const;
  const tools = bar('tools', { render: () => <BarMenu label="Tools" schema={MENU} values={() => undefined} /> });
  const offered = [bars[0]!, bars[1]!, tools];

  it('has one handle, before its button', () => {
    setup(start([['file', 'tools']]), offered);
    const handles = screen.getAllByRole('button', { name: 'Move Tools toolbar' });
    expect(handles).toHaveLength(1);
    expect(handles[0]).toHaveAttribute('data-bar-lead');
    expect(handles[0]!.nextElementSibling).toBe(screen.getByRole('button', { name: 'Tools' }));
  });

  it('moves by a drag on its handle', () => {
    const onChange = setup(start([['file', 'view', 'tools']]), offered);
    press(handle('Tools'), [250, 15], [[240, 15], [40, 15]]);
    release([40, 15]);
    expect(onChange.mock.calls[0]![0].docks.top).toEqual([['tools', 'file', 'view']]);
  });

  it('moves by Alt+arrows on its handle', () => {
    const onChange = setup(start([['tools', 'file', 'view']]), offered);
    act(() => void fireEvent.keyDown(handle('Tools'), { key: 'ArrowRight', altKey: true }));
    expect(onChange.mock.calls[0]![0].docks.top).toEqual([['file', 'tools', 'view']]);
  });
});

describe('a bar nested inside a docked bar', () => {
  it('draws no handle of its own', () => {
    const nested: BarNode = {
      kind: 'opens',
      path: 'more',
      name: 'More things',
      body: () => (
        <BarLayout label="Inner" lead="label" nodes={[{ kind: 'cell', path: 'x', content: <button type="button">x</button> }]} cells={() => []} row={() => null} />
      ),
    };
    setup(start([['outer']]), [bar('outer', {}, [nested])]);
    fireEvent.click(screen.getByRole('button', { name: 'More things' }));
    expect(screen.getByRole('toolbar', { name: 'Inner' })).toBeInTheDocument();
    // The open popover hides the rest of the page from assistive tech, so the handles are counted hidden or not.
    expect(screen.getAllByRole('button', { name: /^Move .* toolbar$/, hidden: true })).toHaveLength(1);
  });
});
