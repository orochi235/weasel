import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { SampledTrack, Track } from '@weasel-js/core';
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
    const nested = [{
      kind: 'timeline', label: 'blink', at: 100,
      timeline: { tracks: [{ kind: 'sampled', label: 'o', keys: [{ t: 0, value: 0 }], onTick: () => {} }] },
    }] as unknown as Track[];
    render(<Timeline {...base} tracks={nested} />);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(2);
  });
});
