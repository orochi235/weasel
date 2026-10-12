import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { SampledTrack, TimelineTrack, Track } from '@weasel-js/animator';
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

  it('holds the mode itself when given no mode', () => {
    const onModeChange = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onModeChange={onModeChange} />);
    const graph = screen.getByRole('switch', { name: 'Graph mode' });
    expect(graph).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(graph);
    expect(graph).toHaveAttribute('aria-checked', 'true');
    expect(onModeChange).toHaveBeenLastCalledWith('graph');
    fireEvent.click(graph);
    expect(graph).toHaveAttribute('aria-checked', 'false');
  });

  it('follows a mode it is given', () => {
    render(<Timeline {...base} tracks={tracks()} mode="dope" />);
    const graph = screen.getByRole('switch', { name: 'Graph mode' });
    fireEvent.click(graph);
    expect(graph).toHaveAttribute('aria-checked', 'false');
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

  it('fits its window to a duration that arrives after mount', () => {
    const { rerender } = render(<Timeline {...base} tracks={tracks()} duration={0} />);
    rerender(<Timeline {...base} tracks={tracks()} duration={2000} />);
    expect(screen.getAllByTestId('timeline-key')[1].style.left).toBe('25%');
  });

  it('keeps a window the user zoomed when the duration changes', () => {
    const { rerender } = render(<Timeline {...base} tracks={tracks()} />);
    fireEvent.wheel(screen.getByTestId('timeline-ruler'), { ctrlKey: true, deltaY: -Math.log(2) / 0.0015, clientX: 0 });
    expect(screen.getAllByTestId('timeline-key')[1].style.left).toBe('100%');
    rerender(<Timeline {...base} tracks={tracks()} duration={2000} />);
    expect(screen.getAllByTestId('timeline-key')[1].style.left).toBe('100%');
  });

  it('keeps focus on a key that an arrow key moves past its neighbor', () => {
    function Host() {
      const [value, setValue] = useState<Track[]>(() => [
        { kind: 'sampled', label: 'x', keys: [{ t: 100, value: 0 }, { t: 105, value: 10 }], onTick: () => {} },
      ] as Track[]);
      return <Timeline {...base} tracks={value} onChange={setValue} />;
    }
    render(<Host />);
    const first = screen.getAllByTestId('timeline-key')[0];
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const moved = screen.getAllByTestId('timeline-key')[1];
    expect(moved).toHaveAccessibleName(/110\s*ms/);
    expect(moved).toHaveAttribute('aria-current', 'true');
    expect(document.activeElement).toBe(moved);
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

  it('leaves Backspace typed into the key editor to the editor', () => {
    const onChange = vi.fn();
    render(
      <Timeline
        {...base}
        tracks={tracks()}
        onChange={onChange}
        renderKeyEditor={() => <input data-testid="key-value" defaultValue="10" />}
      />,
    );
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    const notPrevented = fireEvent.keyDown(screen.getByTestId('key-value'), { key: 'Backspace' });
    expect(onChange).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
    expect(screen.getByTestId('key-value')).toBeInTheDocument();
  });

  it('leaves a Delete a child already handled alone', () => {
    const onChange = vi.fn();
    render(
      <Timeline
        {...base}
        tracks={tracks()}
        onChange={onChange}
        renderKeyEditor={() => (
          <div data-testid="key-list" tabIndex={0} onKeyDown={(e) => e.preventDefault()} />
        )}
      />,
    );
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    fireEvent.keyDown(screen.getByTestId('key-list'), { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not report a change for Delete on an event mark, which it cannot remove', () => {
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByTestId('timeline-event'), { clientX: 125, button: 0 });
    fireEvent.pointerUp(document, { clientX: 125 });
    const notPrevented = fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });

  it('drops the segment selection when a key is deleted or inserted on its track', () => {
    function Host() {
      const [value, setValue] = useState<Track[]>(() => [
        { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 400, value: 5 }, { t: 800, value: 10 }], onTick: () => {} },
      ] as Track[]);
      return <Timeline {...base} tracks={value} onChange={setValue} />;
    }
    render(<Host />);
    fireEvent.click(screen.getAllByTestId('timeline-segment')[1]);
    expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 200, button: 0 });
    fireEvent.pointerUp(document, { clientX: 200 });
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
    expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('timeline-segment')[0]);
    expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    fireEvent.doubleClick(screen.getByTestId('timeline-lane-track'), { clientX: 100 });
    expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
  });

  describe('the easing picker', () => {
    const threeKeys = (): Track[] => ([
      { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 400, value: 5 }, { t: 800, value: 10 }], onTick: () => {} },
    ] as Track[]);
    const editor = () => <span data-testid="key-editor" />;
    const openPicker = (): void => {
      fireEvent.click(screen.getAllByTestId('timeline-segment')[0]);
      expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    };

    it('closes when a key is selected', () => {
      render(<Timeline {...base} tracks={threeKeys()} renderKeyEditor={editor} />);
      openPicker();
      fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[2], { clientX: 400, button: 0 });
      fireEvent.pointerUp(document, { clientX: 400 });
      expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
      expect(screen.getByTestId('key-editor')).toBeInTheDocument();
    });

    it('takes the place of the key editor when a segment is selected', () => {
      render(<Timeline {...base} tracks={threeKeys()} renderKeyEditor={editor} />);
      fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[2], { clientX: 400, button: 0 });
      fireEvent.pointerUp(document, { clientX: 400 });
      expect(screen.getByTestId('key-editor')).toBeInTheDocument();
      openPicker();
      expect(screen.queryByTestId('key-editor')).not.toBeInTheDocument();
    });

    it('tells a consumer holding the selection that a segment took it', () => {
      const onSelect = vi.fn();
      render(<Timeline {...base} tracks={threeKeys()} selection={{ trackPath: [0], keyIndex: 2 }} onSelect={onSelect} />);
      fireEvent.click(screen.getAllByTestId('timeline-segment')[0]);
      expect(onSelect).toHaveBeenLastCalledWith(null);
    });

    it('closes on a press on empty lane', () => {
      render(<Timeline {...base} tracks={threeKeys()} />);
      openPicker();
      fireEvent.pointerDown(screen.getByTestId('timeline-lane-track'), { clientX: 450, button: 0 });
      expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
    });

    it('stays open for a press on its own segment', () => {
      render(<Timeline {...base} tracks={threeKeys()} />);
      openPicker();
      fireEvent.pointerDown(screen.getAllByTestId('timeline-segment')[0], { clientX: 100, button: 0 });
      expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    });

    it('closes on Escape, and leaves an Escape with nothing to close alone', () => {
      render(<Timeline {...base} tracks={threeKeys()} />);
      const root = screen.getByTestId('timeline-root');
      expect(fireEvent.keyDown(root, { key: 'Escape' })).toBe(true);
      openPicker();
      expect(fireEvent.keyDown(root, { key: 'Escape' })).toBe(false);
      expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
    });
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
