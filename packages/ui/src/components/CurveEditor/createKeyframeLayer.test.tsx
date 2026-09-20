import { describe, expect, it, vi } from 'vitest';
import { useMemo, useState, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  createKeyframeLayer,
  keyframeLayerState,
  type KeyframeLayerConfig,
  type KeyframeLayerState,
} from './createKeyframeLayer';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import { handleSize } from '../../handles';

// Plot is 200×100 over t 0..1000, value 0..10; jsdom's svg rect sits at the
// origin, so client coords are plot coords: x = t / 5, y = 100 - value * 10.
const KEYS = [
  { t: 0, value: 0 },
  { t: 500, value: 10, easing: { bezier: [0.4, 0, 0.2, 1] as const } },
  { t: 1000, value: 5 },
];

interface HarnessProps {
  config?: KeyframeLayerConfig;
  initial?: Partial<KeyframeLayerState>;
  onChange?: (next: KeyframeLayerState) => void;
  onCommit?: (next: KeyframeLayerState, prev: KeyframeLayerState) => void;
}

function Harness({ config, initial, onChange, onCommit }: HarnessProps): ReactElement {
  const layer = useMemo(() => createKeyframeLayer({ label: 'x', ...config }), [config]);
  const [state, setState] = useState<KeyframeLayerState>(() => ({ ...keyframeLayerState(KEYS), ...initial }));
  return (
    <LayeredCurveEditor
      layers={[{ layer, state }]}
      onLayerChange={(_id, next) => { setState(next as KeyframeLayerState); onChange?.(next as KeyframeLayerState); }}
      onLayerCommit={(_id, next, prev) => onCommit?.(next as KeyframeLayerState, prev as KeyframeLayerState)}
      width={200}
      height={100}
      xRange={[0, 1000]}
      yRange={[0, 10]}
      history={false}
    />
  );
}

const svg = (): SVGSVGElement => document.querySelector('svg')!;
const down = (x: number, y: number, extra: object = {}) =>
  fireEvent.pointerDown(svg(), { clientX: x, clientY: y, button: 0, pointerId: 1, ...extra });
const move = (x: number, y: number, extra: object = {}) =>
  fireEvent.pointerMove(document, { clientX: x, clientY: y, pointerId: 1, ...extra });
const up = (x: number, y: number) =>
  fireEvent.pointerUp(document, { clientX: x, clientY: y, pointerId: 1 });

describe('createKeyframeLayer — rendering', () => {
  it('renders one focusable, named marker per key', () => {
    render(<Harness config={{ formatX: (t) => `${Math.round(t)} ms` }} />);
    const keys = document.querySelectorAll('[data-keyframe-index]');
    expect(keys).toHaveLength(3);
    for (const k of keys) expect(k.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('button', { name: 'x key at 500 ms' })).toBeInTheDocument();
  });

  it('draws the eased curve from the first key to the last', () => {
    render(<Harness />);
    const d = document.querySelector('[data-curve-element="curve"]')!.getAttribute('d')!;
    expect(d.startsWith('M0.00,100.00')).toBe(true);
    expect(d.endsWith('L200.00,50.00')).toBe(true);
  });

  // The diamond's size is an SVG geometry attribute, readable here; the token
  // behind it is not, because jsdom resolves no var(). Asserting the attribute
  // against `handleSize` stands in for the visual claim that a keyframe key and
  // a timeline key are one size.
  it('draws each key at the default handle rank, centred on its point', () => {
    render(<Harness />);
    const edge = handleSize('--wzl-handle-size');
    for (const k of document.querySelectorAll('rect[data-keyframe-index]')) {
      expect(Number(k.getAttribute('width'))).toBe(edge);
      expect(Number(k.getAttribute('height'))).toBe(edge);
      const [, cx, cy] = /rotate\(45 ([\d.]+) ([\d.]+)\)/.exec(k.getAttribute('transform')!)!;
      expect(Number(k.getAttribute('x'))).toBeCloseTo(Number(cx) - edge / 2);
      expect(Number(k.getAttribute('y'))).toBeCloseTo(Number(cy) - edge / 2);
    }
  });

  it('gives the drag ghost the same geometry as the key it stands for', () => {
    render(<Harness />);
    down(100, 0);
    move(120, 10);
    const ghost = document.querySelector('[data-keyframe-ghost]')!;
    expect(Number(ghost.getAttribute('width'))).toBe(handleSize('--wzl-handle-size'));
  });

  it('labels the plot as a group, not an image, so its keys stay reachable', () => {
    render(<Harness />);
    expect(svg().getAttribute('role')).toBe('group');
  });
});

describe('createKeyframeLayer — key drag', () => {
  it('ghosts the target while the committed key holds, then commits re-sorted', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    down(100, 0);
    move(210, 20);
    const dragged = document.querySelector('[data-keyframe-index="1"]')!;
    expect(dragged.getAttribute('data-dragging')).toBe('true');
    expect(document.querySelector('[data-keyframe-ghost]')).not.toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
    up(210, 20);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0] as KeyframeLayerState;
    expect(next.keys.map((k) => k.t)).toEqual([0, 1000, 1050]);
    expect(next.keys[2].value).toBeCloseTo(8);
    expect(next.keys[2].easing).toEqual(KEYS[1].easing);
    expect(next.selectedKey).toBe(2);
    expect(next.drag).toBeNull();
    expect(document.querySelector('[data-keyframe-ghost]')).toBeNull();
  });

  it('commits the keys untouched when a key is pressed and released in place', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    down(100, 0);
    up(100, 0);
    const next = onCommit.mock.calls[0][0] as KeyframeLayerState;
    expect(next.keys).toBe(KEYS);
    expect(next.selectedKey).toBe(1);
  });

  it('snaps a dragged key to a nearby snap time', () => {
    const onCommit = vi.fn();
    render(<Harness config={{ snapX: [600] }} onCommit={onCommit} />);
    down(100, 0);
    move(125, 0);
    up(125, 0);
    expect((onCommit.mock.calls[0][0] as KeyframeLayerState).keys[1].t).toBe(600);
  });

  it('lets alt defeat snapping', () => {
    const onCommit = vi.fn();
    render(<Harness config={{ snapX: [600] }} onCommit={onCommit} />);
    down(100, 0);
    move(125, 0, { altKey: true });
    up(125, 0);
    expect((onCommit.mock.calls[0][0] as KeyframeLayerState).keys[1].t).toBe(625);
  });

  it('clamps a dragged key to xClamp', () => {
    const onCommit = vi.fn();
    render(<Harness config={{ xClamp: [0, Infinity] }} onCommit={onCommit} />);
    down(100, 0);
    move(-50, 0);
    up(-50, 0);
    expect((onCommit.mock.calls[0][0] as KeyframeLayerState).keys.map((k) => k.t)).toEqual([0, 0, 1000]);
  });

  it('drops the drag without committing when the gesture is canceled', () => {
    const onCommit = vi.fn();
    const onChange = vi.fn();
    render(<Harness onCommit={onCommit} onChange={onChange} />);
    down(100, 0);
    move(150, 0);
    fireEvent.pointerCancel(document, { pointerId: 1 });
    expect(onCommit).not.toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0] as KeyframeLayerState;
    expect(last.drag).toBeNull();
    expect(last.keys).toBe(KEYS);
  });
});

describe('createKeyframeLayer — segments', () => {
  it('selects the segment under a click on the curve, leaving the keys alone', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    down(150, 25);
    const next = onCommit.mock.calls[0][0] as KeyframeLayerState;
    expect(next.selectedSegment).toBe(2);
    expect(next.keys).toBe(KEYS);
  });

  it('ignores a click well away from the curve', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    down(150, 95);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('shows two handles on a selected bezier segment and none on another spec', () => {
    const { unmount } = render(<Harness initial={{ selectedSegment: 1 }} />);
    expect(document.querySelectorAll('[data-handle-index]')).toHaveLength(2);
    unmount();
    render(<Harness initial={{ selectedSegment: 2 }} />);
    expect(document.querySelectorAll('[data-handle-index]')).toHaveLength(0);
  });

  it('drags a bezier handle and commits the easing onto the key it runs into', () => {
    const onCommit = vi.fn();
    render(<Harness initial={{ selectedSegment: 1 }} onCommit={onCommit} />);
    // Handle 1 sits at t = 0.4 × 500 = 200, value 0 → plot (40, 100).
    down(40, 100);
    move(50, 50);
    up(50, 50);
    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0] as KeyframeLayerState;
    expect(next.keys[1].easing).toEqual({ bezier: [0.5, 0.5, 0.2, 1] });
    expect(next.drag).toBeNull();
  });

  it('previews a handle drag without resolving a fresh spec on every move', async () => {
    const core = await import('@weasel-js/core');
    const spy = vi.spyOn(core, 'resolveEasing');
    render(<Harness initial={{ selectedSegment: 1 }} />);
    spy.mockClear();
    down(40, 100);
    for (let i = 0; i < 30; i++) move(40 + i, 100 - i);
    up(70, 70);
    const fresh = spy.mock.calls.filter(([spec]) =>
      typeof spec === 'object' && spec !== null && spec !== KEYS[1].easing);
    expect(fresh.length).toBeLessThan(5);
    spy.mockRestore();
  });
});

describe('createKeyframeLayer — keyboard', () => {
  it('nudges a focused key in time, ten times further with shift', () => {
    const onCommit = vi.fn();
    render(<Harness config={{ step: { x: 10 } }} onCommit={onCommit} />);
    const key = document.querySelector('[data-keyframe-index="1"]')!;
    fireEvent.keyDown(key, { key: 'ArrowRight' });
    expect((onCommit.mock.calls[0][0] as KeyframeLayerState).keys[1].t).toBe(510);
    fireEvent.keyDown(document.querySelector('[data-keyframe-index="1"]')!, { key: 'ArrowLeft', shiftKey: true });
    expect((onCommit.mock.calls[1][0] as KeyframeLayerState).keys[1].t).toBe(410);
  });

  it('nudges a focused key in value with the vertical arrows', () => {
    const onCommit = vi.fn();
    render(<Harness config={{ step: { y: 0.5 } }} onCommit={onCommit} />);
    fireEvent.keyDown(document.querySelector('[data-keyframe-index="2"]')!, { key: 'ArrowUp' });
    expect((onCommit.mock.calls[0][0] as KeyframeLayerState).keys[2].value).toBe(5.5);
  });

  it('selects a focused segment with Enter', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.keyDown(document.querySelector('[data-segment-index="1"]')!, { key: 'Enter' });
    expect((onCommit.mock.calls[0][0] as KeyframeLayerState).selectedSegment).toBe(1);
  });

  it('leaves keys it does not handle to the page', () => {
    const outer = vi.fn();
    render(<div onKeyDown={(e) => outer(e.key, e.defaultPrevented)}><Harness /></div>);
    fireEvent.keyDown(document.querySelector('[data-keyframe-index="1"]')!, { key: 'Delete' });
    expect(outer).toHaveBeenCalledWith('Delete', false);
  });
});
