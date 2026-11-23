import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { Track } from '@weasel-js/animator';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { KitSettingsProvider } from '@weasel-js/react';
import { Lane } from './Lane';
import { buildLanes } from './lanes';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 20,
      width: TRACK_WIDTH, height: 20, toJSON: () => {},
    } as DOMRect;
  };
});

const sampled: Track = {
  kind: 'sampled', label: 'x',
  keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }],
  onTick: () => {},
} as Track;

const eventTrack: Track = {
  kind: 'event', label: 'step',
  events: [{ t: 250, fire: () => {} }],
} as Track;

const base = {
  window: { from: 0, to: 1000 },
  mode: 'dope' as const,
  selection: null,
  onSelectionChange: () => {},
  onKeyInput: () => {},
  onKeyChange: () => {},
  onInsert: () => {},
  onExpandedChange: () => {},
  expanded: false,
  snapTimes: [] as number[],
};

const laneOf = (t: Track) => buildLanes([t], new Set())[0];

describe('Lane', () => {
  it('marks the keys of a nested row that sit past where its timeline stops', () => {
    const parent = { kind: 'timeline', label: 'n', at: 100, timeline: { duration: 300, tracks: [sampled] } } as Track;
    const row = buildLanes([parent], new Set(['0']))[1]!;
    render(<Lane {...base} row={row} />);
    const keys = screen.getAllByTestId('timeline-key');
    expect(keys.map((k) => k.getAttribute('data-past'))).toEqual([null, 'true']);
    expect(screen.getByTestId('timeline-after-end')).toBeTruthy();
  });

  it('draws a nested timeline\'s bar from its own `at` for its duration', () => {
    const nested = { kind: 'timeline', label: 'n', at: 600, timeline: { duration: 400, tracks: [sampled] } } as Track;
    render(<Lane {...base} row={laneOf(nested)} />);
    const bar = screen.getByTestId('timeline-nested');
    expect([bar.style.left, bar.style.width]).toEqual(['60%', '40%']);
  });

  it('sizes a nested timeline with no duration to its last track\'s end, and a negative one to nothing', () => {
    const open = { kind: 'timeline', label: 'n', at: 100, timeline: { tracks: [sampled] } } as Track;
    const { unmount } = render(<Lane {...base} row={laneOf(open)} />);
    expect(screen.getByTestId('timeline-nested').style.width).toBe('50%');
    unmount();
    const negative = { kind: 'timeline', label: 'n', at: 100, timeline: { duration: -50, tracks: [sampled] } } as Track;
    render(<Lane {...base} row={laneOf(negative)} />);
    expect(screen.getByTestId('timeline-nested').style.width).toBe('0%');
  });

  it('runs an endless nested timeline\'s bar to the window\'s end', () => {
    const endless = { kind: 'timeline', label: 'n', at: 100, timeline: { duration: Infinity, tracks: [sampled] } } as Track;
    render(<Lane {...base} row={laneOf(endless)} />);
    expect(screen.getByTestId('timeline-nested').style.width).toBe('90%');
  });

  it('indents a row\'s label by its depth, however deep', () => {
    let track: Track = sampled;
    for (let i = 0; i < 5; i++) track = { kind: 'timeline', label: `n${i}`, at: 0, timeline: { tracks: [track] } } as Track;
    const row = buildLanes([track], new Set(['0', '0.0', '0.0.0', '0.0.0.0', '0.0.0.0.0'])).at(-1)!;
    const { container } = render(<Lane {...base} row={row} />);
    expect(row.depth).toBe(5);
    expect(container.querySelector<HTMLElement>('[data-depth] > div')!.style.getPropertyValue('--depth')).toBe('5');
  });

  it('draws no past-end band on a row that plays to the end', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.queryByTestId('timeline-after-end')).toBeNull();
  });

  it('renders one key per sampled keyframe', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
  });

  it('names each key for a screen reader', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.getAllByRole('button')[0]).toHaveAccessibleName(/x.*0\s*ms/i);
  });

  it('positions a key at its fraction of the window', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.getAllByTestId('timeline-key')[1]).toHaveStyle({ left: '50%' });
  });

  it('renders event crossings as markers', () => {
    render(<Lane {...base} row={laneOf(eventTrack)} />);
    expect(screen.getAllByTestId('timeline-event')).toHaveLength(1);
  });

  it('selects a key on pointerdown', () => {
    const onSelectionChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onSelectionChange={onSelectionChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    expect(onSelectionChange).toHaveBeenCalledWith(1);
  });

  it('leaves a key drag to its finger when a second finger presses another key', () => {
    const onKeyChange = vi.fn();
    const onSelectionChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onSelectionChange={onSelectionChange} onKeyChange={onKeyChange} />);
    const [first, second] = screen.getAllByTestId('timeline-key');
    const touch = (pointerId: number, clientX: number) => ({ clientX, clientY: 10, button: 0, pointerId, pointerType: 'touch' });
    fireEvent.pointerDown(second, touch(1, 250));
    fireEvent.pointerDown(first, touch(2, 0));
    fireEvent.pointerMove(document, touch(1, 350));
    fireEvent.pointerUp(document, touch(1, 350));
    fireEvent.pointerUp(document, touch(2, 0));
    expect(onSelectionChange.mock.calls).toEqual([[1]]);
    expect(onKeyChange.mock.calls).toEqual([[1, 700]]);
  });

  it('puts a key back where it was when the browser cancels its drag', () => {
    const onKeyRevert = vi.fn();
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyRevert={onKeyRevert} onKeyChange={onKeyChange} />);
    const key = screen.getAllByTestId('timeline-key')[1];
    fireEvent.pointerDown(key, { clientX: 250, clientY: 10, button: 0, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerCancel(document, { pointerId: 1, pointerType: 'touch' });
    expect(onKeyRevert).toHaveBeenCalledTimes(1);
    expect(onKeyChange).not.toHaveBeenCalled();
  });

  it('reports live times through the drag and one commit at its end', () => {
    const onKeyInput = vi.fn();
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyInput={onKeyInput} onKeyChange={onKeyChange} />);
    const key = screen.getAllByTestId('timeline-key')[1];
    fireEvent.pointerDown(key, { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 350, clientY: 10 });
    expect(onKeyInput).toHaveBeenCalledTimes(2);
    expect(onKeyChange).toHaveBeenCalledTimes(1);
    expect(onKeyChange).toHaveBeenCalledWith(1, 700);
  });

  it('places a dragged key through the window on screen when it changes mid-drag', () => {
    const onKeyChange = vi.fn();
    const { rerender } = render(<Lane {...base} row={laneOf(sampled)} onKeyChange={onKeyChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    rerender(<Lane {...base} window={{ from: 0, to: 2000 }} row={laneOf(sampled)} onKeyChange={onKeyChange} />);
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 350, clientY: 10 });
    expect(onKeyChange.mock.calls).toEqual([[1, 1400]]);
  });

  it('snaps a dragged key to a nearby snap time', () => {
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} snapTimes={[600]} onKeyChange={onKeyChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerMove(document, { clientX: 301, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 301, clientY: 10 });
    expect(onKeyChange).toHaveBeenCalledWith(1, 600);
  });

  it('lets alt defeat snapping for the drag', () => {
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} snapTimes={[600]} onKeyChange={onKeyChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0, altKey: true });
    fireEvent.pointerMove(document, { clientX: 301, clientY: 10, altKey: true });
    fireEvent.pointerUp(document, { clientX: 301, clientY: 10, altKey: true });
    expect(onKeyChange).toHaveBeenCalledWith(1, 602);
  });

  it('inserts a key on double-click', () => {
    const onInsert = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onInsert={onInsert} />);
    fireEvent.doubleClick(screen.getByTestId('timeline-lane-track'), { clientX: 100 });
    expect(onInsert).toHaveBeenCalledWith(200);
  });

  it('does not insert on a double-click that lands on a key', () => {
    const onInsert = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onInsert={onInsert} />);
    fireEvent.doubleClick(screen.getAllByTestId('timeline-key')[1], { clientX: 250 });
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('selects a key without committing a move when the press does not travel', () => {
    const onSelectionChange = vi.fn();
    const onKeyInput = vi.fn();
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onSelectionChange={onSelectionChange} onKeyInput={onKeyInput} onKeyChange={onKeyChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 252, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 253, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 253, clientY: 10, altKey: true });
    expect(onSelectionChange).toHaveBeenCalledWith(1);
    expect(onKeyInput).not.toHaveBeenCalled();
    expect(onKeyChange).not.toHaveBeenCalled();
  });

  it('moves a key only once the press passes the gestures.dragPx kit setting', () => {
    const onKeyInput = vi.fn();
    render(
      <KitSettingsProvider value={{ gestures: { dragPx: 30 } }}>
        <Lane {...base} row={laneOf(sampled)} onKeyInput={onKeyInput} />
      </KitSettingsProvider>,
    );
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 270, clientY: 10 });
    expect(onKeyInput).not.toHaveBeenCalled();
    fireEvent.pointerMove(document, { clientX: 290, clientY: 10 });
    expect(onKeyInput).toHaveBeenCalled();
    fireEvent.pointerUp(document, { clientX: 290, clientY: 10 });
  });

  it('selects a focused key on Enter or Space', () => {
    const onSelectionChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onSelectionChange={onSelectionChange} />);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'Enter' });
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[0], { key: ' ' });
    expect(onSelectionChange.mock.calls).toEqual([[1], [0]]);
  });

  it('moves a focused key with the arrow keys', () => {
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} selection={1} onKeyChange={onKeyChange} />);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'ArrowRight' });
    expect(onKeyChange).toHaveBeenCalledWith(1, 510);
  });

  it('takes a bigger arrow step with shift', () => {
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} selection={1} onKeyChange={onKeyChange} />);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'ArrowRight', shiftKey: true });
    expect(onKeyChange).toHaveBeenCalledWith(1, 600);
  });

  // PROXY ASSERTION — see Ruler.test.tsx for why this is asserted rather than
  // the browser behaviour it stands in for.
  it('never captures the pointer', () => {
    const capture = vi.fn();
    Element.prototype.setPointerCapture = capture;
    render(<Lane {...base} row={laneOf(sampled)} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 10 });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('Lane in graph mode', () => {
  // The lane is 500×20 (see beforeAll) over 0..1000 ms, so t maps to x = t / 2.
  // Values are padded 8% top and bottom, so the lowest key sits at y = 18.4
  // and the highest at y = 1.6.
  const centerOf = (el: Element): { x: number; y: number } => {
    const [, x, y] = /rotate\(45 ([-\d.e]+) ([-\d.e]+)\)/.exec(el.getAttribute('transform')!)!;
    return { x: Number(x), y: Number(y) };
  };
  const graphKeys = () => document.querySelectorAll('[data-keyframe-index]');
  const eased = {
    kind: 'sampled', label: 'x',
    keys: [{ t: 0, value: 0 }, { t: 500, value: 10, easing: { bezier: [0.4, 0, 0.2, 1] } }],
    onTick: () => {},
  } as unknown as Track;

  it('does not insert on a double-click that lands on a graphed key', () => {
    const onInsert = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} onInsert={onInsert} />);
    fireEvent.doubleClick(graphKeys()[1], { clientX: 250 });
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('draws a curve for a numeric sampled track', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
    expect(document.querySelector('[data-curve-element="curve"]')).toBeInTheDocument();
  });

  it('names each key for a screen reader', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
    expect(screen.getByRole('button', { name: 'x key at 500 ms' })).toBeInTheDocument();
  });

  it('positions a key by value as well as time, inside the lane', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
    const [first, second] = [...graphKeys()].map(centerOf);
    expect(first.x).toBeCloseTo(0);
    expect(first.y).toBeCloseTo(18.4);
    expect(second.x).toBeCloseTo(250);
    expect(second.y).toBeCloseTo(1.6);
  });

  it('draws a flat track\'s keys across the middle of the lane', () => {
    const flat = { ...sampled, keys: [{ t: 0, value: 5 }, { t: 500, value: 5 }] } as Track;
    render(<Lane {...base} mode="graph" row={laneOf(flat)} />);
    expect([...graphKeys()].map((k) => centerOf(k).y)).toEqual([10, 10]);
  });

  it('selects a key on pointerdown', () => {
    const onSelectionChange = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} onSelectionChange={onSelectionChange} />);
    fireEvent.pointerDown(graphKeys()[1], { clientX: 250, clientY: 2, button: 0 });
    expect(onSelectionChange).toHaveBeenCalledWith(1);
  });

  it('compares a pressed key against the committed selection, not an abandoned render\'s', () => {
    const onSelectionChange = vi.fn();
    renderThenAbandon<number | null>(null, 1, (selection) => (
      <Lane {...base} mode="graph" row={laneOf(sampled)} selection={selection} onSelectionChange={onSelectionChange} />
    ));
    fireEvent.pointerDown(graphKeys()[1], { clientX: 250, clientY: 2, button: 0 });
    expect(onSelectionChange).toHaveBeenCalledWith(1);
  });

  it('drags a key in value as well as time, reporting live keys and one commit', () => {
    const onKeysInput = vi.fn();
    const onKeysChange = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} onKeysInput={onKeysInput} onKeysChange={onKeysChange} />);
    fireEvent.pointerDown(graphKeys()[1], { clientX: 250, clientY: 0, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 10 });
    expect(onKeysInput).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(document, { clientX: 200, clientY: 10 });
    expect(onKeysChange).toHaveBeenCalledTimes(1);
    const keys = onKeysChange.mock.calls[0][0];
    expect(keys[1].t).toBe(400);
    expect(keys[1].value).toBeCloseTo(5);
  });

  it.each([null, 1])('puts back its preview and cancels a key drag released where it began, selection %s', (selection) => {
    const onKeysInput = vi.fn();
    const onKeysChange = vi.fn();
    const onCancel = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} selection={selection} onKeysInput={onKeysInput} onKeysChange={onKeysChange} onCancel={onCancel} />);
    fireEvent.pointerDown(graphKeys()[1], { clientX: 250, clientY: 1.6, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 250, clientY: 1.6 });
    fireEvent.pointerUp(document, { clientX: 250, clientY: 1.6 });
    expect(onKeysChange).not.toHaveBeenCalled();
    expect(onKeysInput).toHaveBeenLastCalledWith((sampled as { keys: unknown[] }).keys);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('snaps a dragged key to a nearby snap time, in ruler time', () => {
    const onKeysChange = vi.fn();
    const nested = { ...laneOf(sampled), offset: 100 };
    render(<Lane {...base} mode="graph" row={nested} snapTimes={[700]} onKeysChange={onKeysChange} />);
    // Key 1 sits at ruler 600 → x 300. Dropped at ruler 702 → x 351.
    fireEvent.pointerDown(graphKeys()[1], { clientX: 300, clientY: 2, button: 0 });
    fireEvent.pointerMove(document, { clientX: 351, clientY: 2 });
    fireEvent.pointerUp(document, { clientX: 351, clientY: 2 });
    expect(onKeysChange.mock.calls[0][0][1].t).toBe(600);
  });

  it('moves a focused key with the arrow keys', () => {
    const onKeysChange = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} onKeysChange={onKeysChange} />);
    fireEvent.keyDown(graphKeys()[1], { key: 'ArrowRight', shiftKey: true });
    expect(onKeysChange.mock.calls[0][0][1].t).toBe(600);
  });

  it('leaves the selection and focus on a key whose arrow step a read-only lane refuses', () => {
    const close = { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 50, value: 5 }, { t: 400, value: 10 }], onTick: () => {} } as Track;
    const onSelectionChange = vi.fn();
    const onKeysChange = vi.fn();
    const hold = { edits: false, looks: true, tabIndex: 0 as const, focus: {} };
    render(<Lane {...base} mode="graph" row={laneOf(close)} hold={hold} onSelectionChange={onSelectionChange} onKeysChange={onKeysChange} />);
    const first = graphKeys()[0] as SVGElement;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onKeysChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(first);
  });

  it('selects the segment under a click on the curve', () => {
    const onSelectSegment = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} onSelectSegment={onSelectSegment} />);
    fireEvent.pointerDown(document.querySelector('svg')!, { clientX: 125, clientY: 10, button: 0 });
    expect(onSelectSegment).toHaveBeenCalledWith(1);
  });

  it('commits a dragged bezier handle as the easing on the key', () => {
    const onKeysChange = vi.fn();
    const onKeysInput = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(eased)} selectedSegment={1} onKeysInput={onKeysInput} onKeysChange={onKeysChange} />);
    const handle = document.querySelector('[data-handle-index="0"]')!;
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 18, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 150, clientY: 10 });
    expect(onKeysChange).toHaveBeenCalledTimes(1);
    expect(onKeysChange.mock.calls[0][0][1].easing).toHaveProperty('bezier');
    // A live handle writes a fresh spec per move; none may reach the consumer.
    expect(onKeysInput).not.toHaveBeenCalled();
  });

  it('shows no bezier handles for a spec without control points', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} selectedSegment={1} />);
    expect(document.querySelectorAll('[data-handle-index]')).toHaveLength(0);
  });

  it('stays a dope row for a non-numeric sampled track', () => {
    const posed = {
      kind: 'sampled', label: 'p',
      keys: [{ t: 0, value: { x: 0 } }, { t: 500, value: { x: 1 } }],
      onTick: () => {},
    } as unknown as Track;
    render(<Lane {...base} mode="graph" row={laneOf(posed)} />);
    expect(document.querySelector('[data-curve-element="curve"]')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
  });

  it('labels its value axis with round values', () => {
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function tallLane() {
      return { x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 72, width: TRACK_WIDTH, height: 72, toJSON: () => {} } as DOMRect;
    };
    try {
      render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
      const labels = [...document.querySelectorAll('[data-plot-element="tick-label"][data-axis="y"]')].map((el) => el.textContent);
      expect(labels).toEqual(['0', '5', '10']);
    } finally {
      Element.prototype.getBoundingClientRect = rect;
    }
  });

  it('stays a dope row for an event track', () => {
    render(<Lane {...base} mode="graph" row={laneOf(eventTrack)} />);
    expect(document.querySelector('[data-curve-element="curve"]')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-event')).toHaveLength(1);
  });

  it('commits a key drag released outside the lane', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const onKeysChange = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(eased)} onKeysChange={onKeysChange} />);
    fireEvent.pointerDown(graphKeys()[1], { clientX: 250, clientY: 2, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 2, buttons: 1 });
    fireEvent.pointerUp(outside, { clientX: 300, clientY: 2, bubbles: true });
    expect(onKeysChange).toHaveBeenCalledTimes(1);
    outside.remove();
  });

  it('treats a move with no button held as the release the handle drag missed', () => {
    const onKeysChange = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(eased)} selectedSegment={1} onKeysChange={onKeysChange} />);
    fireEvent.pointerDown(document.querySelector('[data-handle-index="0"]')!, { clientX: 100, clientY: 18, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 10, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 10, buttons: 0 });
    expect(onKeysChange).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(document, { clientX: 250, clientY: 10, buttons: 1 });
    expect(onKeysChange).toHaveBeenCalledTimes(1);
  });
});

describe('Lane segment selection', () => {
  it('selects the segment running into a key', () => {
    const onSelectSegment = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onSelectSegment={onSelectSegment} />);
    fireEvent.click(screen.getAllByTestId('timeline-segment')[0]);
    expect(onSelectSegment).toHaveBeenCalledWith(1);
  });

  it('renders one segment per gap between keys', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.getAllByTestId('timeline-segment')).toHaveLength(1);
  });

  it('renders no segments on an event row', () => {
    render(<Lane {...base} row={laneOf(eventTrack)} />);
    expect(screen.queryAllByTestId('timeline-segment')).toHaveLength(0);
  });

  describe('drag ghost', () => {
    const grab = (i: number) =>
      fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[i], { clientX: 0, clientY: 10, button: 0 });

    it('shows no ghost until a drag starts', () => {
      render(<Lane {...base} row={laneOf(sampled)} />);
      expect(screen.queryByTestId('timeline-key-ghost')).not.toBeInTheDocument();
    });

    it('puts the ghost on the grabbed key before the pointer has moved', () => {
      render(<Lane {...base} row={laneOf(sampled)} />);
      grab(1);
      expect(screen.getByTestId('timeline-key-ghost')).toHaveStyle({ left: '50%' });
    });

    it('moves the ghost with the pointer without committing', () => {
      const onKeyChange = vi.fn();
      render(<Lane {...base} row={laneOf(sampled)} onKeyChange={onKeyChange} />);
      grab(1);
      fireEvent.pointerMove(document, { clientX: 400, clientY: 10 });
      expect(screen.getByTestId('timeline-key-ghost')).toHaveStyle({ left: '80%' });
      expect(onKeyChange).not.toHaveBeenCalled();
    });

    it('marks the grabbed key as the drag origin, so it can be dimmed', () => {
      render(<Lane {...base} row={laneOf(sampled)} />);
      grab(1);
      expect(screen.getAllByTestId('timeline-key')[1]).toHaveAttribute('data-dragging', 'true');
      expect(screen.getAllByTestId('timeline-key')[0]).not.toHaveAttribute('data-dragging');
    });

    it('draws the drag from the keys it began from while the consumer applies its previews', () => {
      const { rerender } = render(<Lane {...base} selection={0} row={laneOf(sampled)} />);
      grab(0);
      fireEvent.pointerMove(document, { clientX: 400, clientY: 10 });
      const moved = { ...sampled, keys: [{ t: 500, value: 10 }, { t: 800, value: 0 }] } as Track;
      rerender(<Lane {...base} selection={0} row={laneOf(moved)} />);
      const dragged = screen.getAllByTestId('timeline-key').find((k) => k.hasAttribute('data-dragging'))!;
      expect(dragged).toHaveStyle({ left: '0%' });
      expect(dragged).toHaveAttribute('aria-current', 'true');
    });

    it('clears the ghost on pointerup', () => {
      render(<Lane {...base} row={laneOf(sampled)} />);
      grab(1);
      fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
      expect(screen.queryByTestId('timeline-key-ghost')).not.toBeInTheDocument();
    });

    it('clears the ghost when the gesture is cancelled', () => {
      render(<Lane {...base} row={laneOf(sampled)} />);
      grab(1);
      fireEvent.pointerCancel(document, { clientX: 400, clientY: 10 });
      expect(screen.queryByTestId('timeline-key-ghost')).not.toBeInTheDocument();
    });

    it('ghosts an event crossing too', () => {
      render(<Lane {...base} row={laneOf(eventTrack)} />);
      fireEvent.pointerDown(screen.getAllByTestId('timeline-event')[0], { clientX: 0, clientY: 10, button: 0 });
      expect(screen.getByTestId('timeline-key-ghost')).toBeInTheDocument();
    });
  });
});

describe('Lane pointer session', () => {
  it('commits a key drag released outside the lane', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyChange={onKeyChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10, buttons: 1 });
    fireEvent.pointerUp(outside, { clientX: 350, clientY: 10, bubbles: true });
    expect(onKeyChange).toHaveBeenCalledTimes(1);
    expect(onKeyChange).toHaveBeenCalledWith(1, 700);
  });

  // Chrome releases capture a beat before it delivers pointerup, so ending the
  // drag on `lostpointercapture` throws away a release already dispatched. The
  // other half of the rule — a detached origin does cancel — belongs to
  // pointerSession.test.ts, which owns it without React in the way.
  it('keeps a key drag alive when the key loses capture but stays mounted', () => {
    const onKeyChange = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyChange={onKeyChange} />);
    const key = screen.getAllByTestId('timeline-key')[1];
    fireEvent.pointerDown(key, { clientX: 250, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10, buttons: 1 });
    fireEvent(key, new PointerEvent('lostpointercapture', { pointerId: 0, bubbles: true }));
    expect(screen.queryByTestId('timeline-key-ghost')).toBeInTheDocument();
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(onKeyChange).toHaveBeenCalledTimes(1);
  });

  it('treats a move with no button held as the release the key drag missed', () => {
    const onKeyChange = vi.fn();
    const onKeyInput = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyInput={onKeyInput} onKeyChange={onKeyChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 10, buttons: 0 });
    expect(onKeyInput).toHaveBeenCalledTimes(1);
    expect(onKeyChange).toHaveBeenCalledTimes(1);
    expect(onKeyChange).toHaveBeenCalledWith(1, 800);
    expect(screen.queryByTestId('timeline-key-ghost')).not.toBeInTheDocument();
  });
});

describe('Lane names on a row offset along the ruler', () => {
  const offsetRow = { ...laneOf(sampled), offset: 600 };

  it('names its keys and segments by the ruler time they are drawn at', () => {
    render(<Lane {...base} row={offsetRow} />);
    expect(screen.getAllByTestId('timeline-key').map((k) => k.getAttribute('aria-label')))
      .toEqual(['x key at 600 ms', 'x key at 1100 ms']);
    expect(screen.getByTestId('timeline-segment').getAttribute('aria-label')).toBe('x segment into 1100 ms');
  });

  it('names its graphed keys and segments by ruler time too', () => {
    render(<Lane {...base} mode="graph" row={offsetRow} />);
    expect([...document.querySelectorAll('[data-keyframe-index]')].map((k) => k.getAttribute('aria-label')))
      .toEqual(['x key at 600 ms', 'x key at 1100 ms']);
    expect(document.querySelector('[data-segment-index]')!.getAttribute('aria-label')).toBe('x segment into 1100 ms');
  });
});

describe('Lane nested bar under a parent that stops early', () => {
  it('ends the bar where the timeline around it stops playing it', () => {
    const inner = { kind: 'timeline', label: 'B', at: 200, timeline: { duration: 400, tracks: [] } };
    const outer = { kind: 'timeline', label: 'A', at: 0, timeline: { duration: 300, tracks: [inner] } } as unknown as Track;
    const row = buildLanes([outer], new Set(['0']))[1];
    render(<Lane {...base} row={row} />);
    const bar = screen.getByTestId('timeline-nested');
    expect(bar.style.left).toBe('20%');
    expect(bar.style.width).toBe('10%');
  });
});
