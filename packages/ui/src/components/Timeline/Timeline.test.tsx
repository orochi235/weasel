import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { SampledTrack, TimelineTrack, Track } from '@weasel-js/core';
import { Timeline } from './Timeline';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 20,
      width: TRACK_WIDTH, height: 20, toJSON: () => {},
    } as DOMRect;
  };
});

const tracks = (): Track[] => ([
  { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} },
  { kind: 'event', label: 'step', events: [{ t: 250, fire: () => {} }] },
] as Track[]);

/** A single nested timeline offset by 100ms, holding one two-key track. */
const nestedTracks = (): Track[] => ([{
  kind: 'timeline', label: 'blink', at: 100,
  timeline: {
    tracks: [{
      kind: 'sampled', label: 'o',
      keys: [{ t: 0, value: 0 }, { t: 300, value: 10 }],
      onTick: () => {},
    }],
  },
}] as unknown as Track[]);

const nestedKeyTimes = (out: Track[]): number[] =>
  ((out[0] as TimelineTrack).timeline.tracks[0] as SampledTrack<number>).keys.map((k) => k.t);

const base = {
  duration: 1000,
  playhead: 0,
  onChange: () => {},
  onScrub: () => {},
};

describe('Timeline', () => {
  it('renders one lane per track', () => {
    render(<Timeline {...base} tracks={tracks()} />);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(2);
  });

  it('renders the transport by default', () => {
    render(<Timeline {...base} tracks={tracks()} />);
    expect(screen.getByTestId('timeline-time')).toBeInTheDocument();
  });

  it('hides the transport when told to', () => {
    render(<Timeline {...base} tracks={tracks()} transport={false} />);
    expect(screen.queryByTestId('timeline-time')).not.toBeInTheDocument();
  });

  it('commits a dragged key once, with the track re-sorted', () => {
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    const key = screen.getAllByTestId('timeline-key')[0];
    fireEvent.pointerDown(key, { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys.map((k) => k.t)).toEqual([500, 800]);
  });

  it('reports live positions through onInput without committing', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onInput={onInput} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 10 });
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves a track’s callbacks across an edit', () => {
    const input = tracks();
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={input} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 10 });
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).onTick).toBe((input[0] as SampledTrack<number>).onTick);
  });

  it('scrubs from the ruler', () => {
    const onScrub = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onScrub={onScrub} />);
    fireEvent.pointerDown(screen.getByTestId('timeline-ruler'), { clientX: 250, clientY: 5, button: 0 });
    expect(onScrub).toHaveBeenCalledWith(500);
  });

  it('deletes the selected key on Delete', () => {
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys).toHaveLength(1);
  });

  it('renders the consumer’s key editor for the selection', () => {
    render(
      <Timeline
        {...base}
        tracks={tracks()}
        renderKeyEditor={({ key }) => <span data-testid="key-editor">{String(key.value)}</span>}
      />,
    );
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    expect(screen.getByTestId('key-editor')).toHaveTextContent('10');
  });

  it('commits a value written through the key editor', () => {
    const onChange = vi.fn();
    render(
      <Timeline
        {...base}
        tracks={tracks()}
        onChange={onChange}
        renderKeyEditor={({ commit, key }) => (
          <button type="button" onClick={() => commit({ ...key, value: 42 })}>set</button>
        )}
      />,
    );
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys[1].value).toBe(42);
  });

  it('expands a nested timeline to show its children', () => {
    render(<Timeline {...base} tracks={nestedTracks()} />);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(2);
  });

  it('drags a key inside an expanded nested timeline', () => {
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={nestedTracks()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    // The nested track sits at `at: 100`, so a key dropped at ruler 800ms is
    // 700ms into the child.
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(nestedKeyTimes(onChange.mock.calls[0][0] as Track[])).toEqual([300, 700]);
  });

  it('deletes a selected nested key', () => {
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={nestedTracks()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 10 });
    onChange.mockClear();
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    expect(nestedKeyTimes(onChange.mock.calls[0][0] as Track[])).toEqual([300]);
  });

  it('snaps a nested key against ruler times, not track-local ones', () => {
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={nestedTracks()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    // The sibling key is local 300, ruler 400 — 200px in. Dropped 4px shy of
    // it, inside the 6px snap radius, so it lands exactly on it.
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 196, clientY: 10 });
    expect(nestedKeyTimes(onChange.mock.calls[0][0] as Track[])).toEqual([300, 300]);
  });
});
