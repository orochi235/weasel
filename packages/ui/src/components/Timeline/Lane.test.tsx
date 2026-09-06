import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { Track } from '@weasel-js/core';
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
  onSelect: () => {},
  onKeyInput: () => {},
  onKeyCommit: () => {},
  onInsert: () => {},
  onToggleExpand: () => {},
  expanded: false,
  snapTimes: [] as number[],
};

const laneOf = (t: Track) => buildLanes([t], new Set())[0];

describe('Lane', () => {
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
    const onSelect = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('reports live times through the drag and one commit at its end', () => {
    const onKeyInput = vi.fn();
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyInput={onKeyInput} onKeyCommit={onKeyCommit} />);
    const key = screen.getAllByTestId('timeline-key')[1];
    fireEvent.pointerDown(key, { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 350, clientY: 10 });
    expect(onKeyInput).toHaveBeenCalledTimes(2);
    expect(onKeyCommit).toHaveBeenCalledTimes(1);
    expect(onKeyCommit).toHaveBeenCalledWith(1, 700);
  });

  it('snaps a dragged key to a nearby snap time', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} snapTimes={[600]} onKeyCommit={onKeyCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerMove(document, { clientX: 301, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 301, clientY: 10 });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 600);
  });

  it('lets alt defeat snapping for the drag', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} snapTimes={[600]} onKeyCommit={onKeyCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0, altKey: true });
    fireEvent.pointerMove(document, { clientX: 301, clientY: 10, altKey: true });
    fireEvent.pointerUp(document, { clientX: 301, clientY: 10, altKey: true });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 602);
  });

  it('inserts a key on double-click', () => {
    const onInsert = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onInsert={onInsert} />);
    fireEvent.doubleClick(screen.getByTestId('timeline-lane-track'), { clientX: 100 });
    expect(onInsert).toHaveBeenCalledWith(200);
  });

  it('moves a focused key with the arrow keys', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} selection={1} onKeyCommit={onKeyCommit} />);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'ArrowRight' });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 510);
  });

  it('takes a bigger arrow step with shift', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} selection={1} onKeyCommit={onKeyCommit} />);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'ArrowRight', shiftKey: true });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 600);
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
  it('draws a curve for a numeric sampled track', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
    expect(screen.getByTestId('timeline-curve')).toBeInTheDocument();
  });

  // Not 0% and 100%: the value axis is inset by V_INSET_PCT so a key at the
  // minimum centres inside the lane rather than on its border, where it would
  // hang half into the lane below.
  it('positions a key by value as well as time, inside the lane', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
    const [first, second] = screen.getAllByTestId('timeline-key');
    expect(first).toHaveStyle({ bottom: '8%' });
    expect(second).toHaveStyle({ bottom: '92%' });
  });

  it('keeps the extreme keys clear of both lane borders', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
    for (const el of screen.getAllByTestId('timeline-key')) {
      const pct = Number.parseFloat((el as HTMLElement).style.bottom);
      expect(pct).toBeGreaterThan(0);
      expect(pct).toBeLessThan(100);
    }
  });

  it('drags a key in value as well as time', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} onKeyCommit={onKeyCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 0, button: 0 });
    fireEvent.pointerMove(document, { clientX: 250, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 250, clientY: 10 });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 500, expect.closeTo(5, 1));
  });

  it('stays a dope row for a non-numeric sampled track', () => {
    const posed = {
      kind: 'sampled', label: 'p',
      keys: [{ t: 0, value: { x: 0 } }, { t: 500, value: { x: 1 } }],
      onTick: () => {},
    } as unknown as Track;
    render(<Lane {...base} mode="graph" row={laneOf(posed)} />);
    expect(screen.queryByTestId('timeline-curve')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
  });

  it('stays a dope row for an event track', () => {
    render(<Lane {...base} mode="graph" row={laneOf(eventTrack)} />);
    expect(screen.queryByTestId('timeline-curve')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-event')).toHaveLength(1);
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

  it('drags a bezier handle in graph mode', () => {
    const onEasingCommit = vi.fn();
    const eased = {
      kind: 'sampled', label: 'x',
      keys: [{ t: 0, value: 0 }, { t: 500, value: 10, easing: { bezier: [0.4, 0, 0.2, 1] } }],
      onTick: () => {},
    } as unknown as Track;
    render(<Lane {...base} mode="graph" row={laneOf(eased)} selectedSegment={1} onEasingCommit={onEasingCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-bezier-handle')[0], { clientX: 100, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 150, clientY: 10 });
    expect(onEasingCommit).toHaveBeenCalledTimes(1);
    expect(onEasingCommit.mock.calls[0][1]).toHaveProperty('bezier');
  });

  it('shows no bezier handles for a spec without control points', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} selectedSegment={1} />);
    expect(screen.queryAllByTestId('timeline-bezier-handle')).toHaveLength(0);
  });

  // Guards the bezierCache-growth hazard: a naive live preview that resolves a
  // fresh bezier spec through resolveEasing/sampleEasing on every pointermove
  // adds one permanent cache entry per move. The fix previews through
  // cubicBezierEasing directly, so resolveEasing sees only the initial render.
  it('previews a bezier drag without resolving a fresh spec on every move', async () => {
    const core = await import('@weasel-js/core');
    const resolveEasingSpy = vi.spyOn(core, 'resolveEasing');
    resolveEasingSpy.mockClear();
    const eased = {
      kind: 'sampled', label: 'x',
      keys: [{ t: 0, value: 0 }, { t: 500, value: 10, easing: { bezier: [0.4, 0, 0.2, 1] } }],
      onTick: () => {},
    } as unknown as Track;
    render(<Lane {...base} mode="graph" row={laneOf(eased)} selectedSegment={1} onEasingCommit={() => {}} />);
    resolveEasingSpy.mockClear();
    fireEvent.pointerDown(screen.getAllByTestId('timeline-bezier-handle')[0], { clientX: 100, clientY: 10, button: 0 });
    for (let i = 0; i < 30; i++) {
      fireEvent.pointerMove(document, { clientX: 100 + i, clientY: 10 });
    }
    fireEvent.pointerUp(document, { clientX: 130, clientY: 10 });
    expect(resolveEasingSpy.mock.calls.length).toBeLessThan(5);
    resolveEasingSpy.mockRestore();
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
      const onKeyCommit = vi.fn();
      render(<Lane {...base} row={laneOf(sampled)} onKeyCommit={onKeyCommit} />);
      grab(1);
      fireEvent.pointerMove(document, { clientX: 400, clientY: 10 });
      expect(screen.getByTestId('timeline-key-ghost')).toHaveStyle({ left: '80%' });
      expect(onKeyCommit).not.toHaveBeenCalled();
    });

    it('marks the grabbed key as the drag origin, so it can be dimmed', () => {
      render(<Lane {...base} row={laneOf(sampled)} />);
      grab(1);
      expect(screen.getAllByTestId('timeline-key')[1]).toHaveAttribute('data-dragging', 'true');
      expect(screen.getAllByTestId('timeline-key')[0]).not.toHaveAttribute('data-dragging');
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
  const graphBase = { ...base, mode: 'graph' as const };

  it('commits a key drag released outside the lane', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyCommit={onKeyCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10, buttons: 1 });
    fireEvent.pointerUp(outside, { clientX: 350, clientY: 10, bubbles: true });
    expect(onKeyCommit).toHaveBeenCalledTimes(1);
    expect(onKeyCommit).toHaveBeenCalledWith(1, 700);
  });

  // Chrome releases capture a beat before it delivers pointerup, so ending the
  // drag on `lostpointercapture` throws away a release already dispatched. The
  // other half of the rule — a detached origin does cancel — belongs to
  // pointerSession.test.ts, which owns it without React in the way.
  it('keeps a key drag alive when the key loses capture but stays mounted', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyCommit={onKeyCommit} />);
    const key = screen.getAllByTestId('timeline-key')[1];
    fireEvent.pointerDown(key, { clientX: 250, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10, buttons: 1 });
    fireEvent(key, new PointerEvent('lostpointercapture', { pointerId: 0, bubbles: true }));
    expect(screen.queryByTestId('timeline-key-ghost')).toBeInTheDocument();
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(onKeyCommit).toHaveBeenCalledTimes(1);
  });

  it('treats a move with no button held as the release the key drag missed', () => {
    const onKeyCommit = vi.fn();
    const onKeyInput = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyInput={onKeyInput} onKeyCommit={onKeyCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 10, buttons: 0 });
    expect(onKeyInput).toHaveBeenCalledTimes(1);
    expect(onKeyCommit).toHaveBeenCalledTimes(1);
    expect(onKeyCommit).toHaveBeenCalledWith(1, 800);
    expect(screen.queryByTestId('timeline-key-ghost')).not.toBeInTheDocument();
  });

  it('commits a bezier-handle drag released outside the lane', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const onEasingCommit = vi.fn();
    const eased = {
      kind: 'sampled', label: 'x', numeric: true,
      keys: [{ t: 0, value: 0 }, { t: 500, value: 10, easing: { bezier: [0.25, 0.1, 0.25, 1] } }],
      onTick: () => {},
    } as unknown as Track;
    render(<Lane {...graphBase} row={laneOf(eased)} selectedSegment={1} onEasingCommit={onEasingCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-bezier-handle')[0], { clientX: 100, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 10, buttons: 1 });
    fireEvent.pointerUp(outside, { clientX: 150, clientY: 10, bubbles: true });
    expect(onEasingCommit).toHaveBeenCalledTimes(1);
    outside.remove();
  });

  it('treats a move with no button held as the release the handle drag missed', () => {
    const onEasingCommit = vi.fn();
    const eased = {
      kind: 'sampled', label: 'x', numeric: true,
      keys: [{ t: 0, value: 0 }, { t: 500, value: 10, easing: { bezier: [0.25, 0.1, 0.25, 1] } }],
      onTick: () => {},
    } as unknown as Track;
    render(<Lane {...graphBase} row={laneOf(eased)} selectedSegment={1} onEasingCommit={onEasingCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-bezier-handle')[0], { clientX: 100, clientY: 10, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 10, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 10, buttons: 0 });
    expect(onEasingCommit).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(document, { clientX: 250, clientY: 10, buttons: 1 });
    expect(onEasingCommit).toHaveBeenCalledTimes(1);
  });
});
