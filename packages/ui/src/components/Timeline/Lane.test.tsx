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
