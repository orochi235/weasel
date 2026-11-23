import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
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
  onSeek: () => {},
};

describe('Timeline', () => {
  it('renders one lane per track', () => {
    renderWithIcons(<Timeline {...base} tracks={tracks()} />);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(2);
  });

  it('draws the time readout and the Graph switch, and no playback controls, with no transport', () => {
    renderWithIcons(<Timeline {...base} tracks={tracks()} playhead={250} />);
    expect(screen.getByTestId('timeline-time')).toHaveTextContent('0.25s / 1.00s');
    expect(screen.getByRole('switch', { name: 'Graph mode' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Loop' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Rate' })).not.toBeInTheDocument();
    expect(screen.queryByText('Rate')).not.toBeInTheDocument();
  });

  it('draws the playback controls of a transport it is given', () => {
    const onPlay = vi.fn();
    renderWithIcons(
      <Timeline
        {...base}
        tracks={tracks()}
        transport={{ playing: false, loop: false, rate: 1, onPlayingChange: onPlay, onLoopChange: () => {}, onRateChange: () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('timeline-time')).toBeInTheDocument();
  });

  it('holds the mode itself when given no mode', () => {
    const onModeChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onModeChange={onModeChange} />);
    const graph = screen.getByRole('switch', { name: 'Graph mode' });
    expect(graph).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(graph);
    expect(graph).toHaveAttribute('aria-checked', 'true');
    expect(onModeChange).toHaveBeenLastCalledWith('graph');
    fireEvent.click(graph);
    expect(graph).toHaveAttribute('aria-checked', 'false');
  });

  it('follows a mode it is given', () => {
    renderWithIcons(<Timeline {...base} tracks={tracks()} mode="dope" />);
    const graph = screen.getByRole('switch', { name: 'Graph mode' });
    fireEvent.click(graph);
    expect(graph).toHaveAttribute('aria-checked', 'false');
  });

  it('hides the transport when told to', () => {
    renderWithIcons(<Timeline {...base} tracks={tracks()} transport={false} />);
    expect(screen.queryByTestId('timeline-time')).not.toBeInTheDocument();
  });

  it('commits a dragged key once, with the track re-sorted', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    const key = screen.getAllByTestId('timeline-key')[0];
    fireEvent.pointerDown(key, { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys.map((k) => k.t)).toEqual([500, 800]);
  });

  it('commits nothing for a key drag released where it began', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    const key = screen.getAllByTestId('timeline-key')[0];
    fireEvent.pointerDown(key, { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 10 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits nothing for an arrow key on a key that cannot move', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    const first = screen.getAllByTestId('timeline-key')[0];
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports live positions through onInput without committing', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onInput={onInput} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 10 });
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hands back the tracks as they were when a drag is canceled, keys sharing a time in their order', () => {
    const input = [{ kind: 'sampled', label: 'hold', keys: [{ t: 500, value: 1 }, { t: 500, value: 2 }], onTick: () => {} }] as Track[];
    const onInput = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={input} onInput={onInput} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10 });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect((onInput.mock.calls.at(-1)![0][0] as SampledTrack<number>).keys.map((k) => k.value)).toEqual([1, 2]);
  });

  it('refuses a key deleted or stepped from the keyboard while a key drag is held', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    const key = screen.getAllByTestId('timeline-key')[1];
    fireEvent.pointerDown(key, { clientX: 250, clientY: 10, button: 0 });
    fireEvent.keyDown(key, { key: 'Backspace' });
    fireEvent.keyDown(key, { key: 'ArrowRight' });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10, buttons: 1 });
    fireEvent.keyDown(key, { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(document, { clientX: 350, clientY: 10 });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('preserves a track’s callbacks across an edit', () => {
    const input = tracks();
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={input} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 10 });
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).onTick).toBe((input[0] as SampledTrack<number>).onTick);
  });

  it('scrubs from the ruler', () => {
    const onSeek = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onSeek={onSeek} />);
    fireEvent.pointerDown(screen.getByTestId('timeline-ruler'), { clientX: 250, clientY: 5, button: 0 });
    expect(onSeek).toHaveBeenCalledWith(500);
  });

  it('fits its window to a duration that arrives after mount', () => {
    const { rerender } = renderWithIcons(<Timeline {...base} tracks={tracks()} duration={0} />);
    rerender(<Timeline {...base} tracks={tracks()} duration={2000} />);
    expect(screen.getAllByTestId('timeline-key')[1].style.left).toBe('25%');
  });

  it('keeps a window the user zoomed when the duration changes', () => {
    const { rerender } = renderWithIcons(<Timeline {...base} tracks={tracks()} />);
    fireEvent.wheel(screen.getByTestId('timeline-ruler'), { ctrlKey: true, deltaY: -Math.log(2) / 0.0015, clientX: 0 });
    expect(screen.getAllByTestId('timeline-key')[1].style.left).toBe('100%');
    rerender(<Timeline {...base} tracks={tracks()} duration={2000} />);
    expect(screen.getAllByTestId('timeline-key')[1].style.left).toBe('100%');
  });

  it('still zooms its own window when onWindowChange only observes', () => {
    const onWindowChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onWindowChange={onWindowChange} />);
    fireEvent.wheel(screen.getByTestId('timeline-ruler'), { ctrlKey: true, deltaY: -Math.log(2) / 0.0015, clientX: 0 });
    expect(onWindowChange).toHaveBeenCalledWith({ from: 0, to: 500 });
    expect(screen.getAllByTestId('timeline-key')[1].style.left).toBe('100%');
  });

  it('still selects a key itself when onSelectionChange only observes', () => {
    const onSelectionChange = vi.fn();
    const editor = () => <span data-testid="key-editor" />;
    renderWithIcons(<Timeline {...base} tracks={tracks()} onSelectionChange={onSelectionChange} renderKeyEditor={editor} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    expect(onSelectionChange).toHaveBeenLastCalledWith({ trackPath: [0], keyIndex: 1 });
    expect(screen.getByTestId('key-editor')).toBeInTheDocument();
  });

  it('keeps focus on a key that an arrow key moves past its neighbor', () => {
    function Host() {
      const [value, setValue] = useState<Track[]>(() => [
        { kind: 'sampled', label: 'x', keys: [{ t: 100, value: 0 }, { t: 105, value: 10 }], onTick: () => {} },
      ] as Track[]);
      return <Timeline {...base} tracks={value} onChange={setValue} />;
    }
    renderWithIcons(<Host />);
    const first = screen.getAllByTestId('timeline-key')[0];
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const moved = screen.getAllByTestId('timeline-key')[1];
    expect(moved).toHaveAccessibleName(/110\s*ms/);
    expect(moved).toHaveAttribute('aria-current', 'true');
    expect(document.activeElement).toBe(moved);
  });

  it('keeps focus on the key that is selected once Delete removes the focused one', () => {
    function Host() {
      const [value, setValue] = useState<Track[]>(() => [
        { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 100, value: 1 }, { t: 200, value: 2 }], onTick: () => {} },
      ] as Track[]);
      return <Timeline {...base} tracks={value} onChange={setValue} />;
    }
    renderWithIcons(<Host />);
    for (const at of [2, 1]) {
      const key = screen.getAllByTestId('timeline-key')[at]!;
      key.focus();
      fireEvent.keyDown(key, { key: 'Enter' });
      fireEvent.keyDown(key, { key: 'Delete' });
      const selected = screen.getAllByTestId('timeline-key').find((k) => k.getAttribute('aria-current') === 'true');
      expect(selected).toBeDefined();
      expect(document.activeElement).toBe(selected);
    }
  });

  it('keeps focus on the key that is selected once Delete removes the focused one in graph mode', () => {
    function Host() {
      const [value, setValue] = useState<Track[]>(() => [
        { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 100, value: 1 }, { t: 200, value: 2 }], onTick: () => {} },
      ] as Track[]);
      return <Timeline {...base} mode="graph" tracks={value} onChange={setValue} />;
    }
    renderWithIcons(<Host />);
    const keys = () => [...document.querySelectorAll<SVGElement>('[data-keyframe-index]')];
    for (const at of [2, 1]) {
      const key = keys()[at]!;
      key.focus();
      fireEvent.keyDown(key, { key: 'Enter' });
      fireEvent.keyDown(key, { key: 'Delete' });
      expect(keys()).toHaveLength(at);
      expect(document.activeElement).toBe(keys()[at - 1]);
    }
  });

  it('deletes the key Delete is pressed on, not another one selected', () => {
    const onChange = vi.fn();
    const three = [
      { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 100, value: 1 }, { t: 200, value: 2 }], onTick: () => {} },
    ] as Track[];
    renderWithIcons(<Timeline {...base} tracks={three} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, button: 0 });
    fireEvent.pointerUp(document, { clientX: 0 });
    onChange.mockClear();
    const key = screen.getAllByTestId('timeline-key')[2]!;
    key.focus();
    fireEvent.keyDown(key, { key: 'Delete' });
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys.map((k) => k.t)).toEqual([0, 100]);
  });

  it('deletes nothing for Delete on an event mark while a key elsewhere is selected', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    const mark = screen.getByTestId('timeline-event');
    mark.focus();
    fireEvent.keyDown(mark, { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes the selected key on Delete', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys).toHaveLength(1);
  });

  it('leaves Backspace typed into the key editor to the editor', () => {
    const onChange = vi.fn();
    renderWithIcons(
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
    renderWithIcons(
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
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
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
    renderWithIcons(<Host />);
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
      renderWithIcons(<Timeline {...base} tracks={threeKeys()} renderKeyEditor={editor} />);
      openPicker();
      fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[2], { clientX: 400, button: 0 });
      fireEvent.pointerUp(document, { clientX: 400 });
      expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
      expect(screen.getByTestId('key-editor')).toBeInTheDocument();
    });

    it('takes the place of the key editor when a segment is selected', () => {
      renderWithIcons(<Timeline {...base} tracks={threeKeys()} renderKeyEditor={editor} />);
      fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[2], { clientX: 400, button: 0 });
      fireEvent.pointerUp(document, { clientX: 400 });
      expect(screen.getByTestId('key-editor')).toBeInTheDocument();
      openPicker();
      expect(screen.queryByTestId('key-editor')).not.toBeInTheDocument();
    });

    it('tells a consumer holding the selection that a segment took it', () => {
      const onSelectionChange = vi.fn();
      renderWithIcons(<Timeline {...base} tracks={threeKeys()} selection={{ trackPath: [0], keyIndex: 2 }} onSelectionChange={onSelectionChange} />);
      fireEvent.click(screen.getAllByTestId('timeline-segment')[0]);
      expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    });

    it('closes when a consumer holding the selection selects a key', () => {
      const { rerender } = renderWithIcons(<Timeline {...base} tracks={threeKeys()} selection={null} renderKeyEditor={editor} />);
      openPicker();
      rerender(<Timeline {...base} tracks={threeKeys()} selection={{ trackPath: [0], keyIndex: 2 }} renderKeyEditor={editor} />);
      expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
      expect(screen.getByTestId('key-editor')).toBeInTheDocument();
    });

    it('closes when an edit from outside moves its track\'s keys, and stays open for one that leaves their times', () => {
      const { rerender } = renderWithIcons(<Timeline {...base} tracks={threeKeys()} />);
      openPicker();
      const revalued = threeKeys();
      (revalued[0] as SampledTrack<number>).keys[1].value = 7;
      rerender(<Timeline {...base} tracks={revalued} />);
      expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
      const moved = threeKeys();
      (moved[0] as SampledTrack<number>).keys[0].t = 500;
      (moved[0] as SampledTrack<number>).keys.sort((a, b) => a.t - b.t);
      rerender(<Timeline {...base} tracks={moved} />);
      expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
    });

    it('closes on a press on empty lane', () => {
      renderWithIcons(<Timeline {...base} tracks={threeKeys()} />);
      openPicker();
      fireEvent.pointerDown(screen.getByTestId('timeline-lane-track'), { clientX: 450, button: 0 });
      expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
    });

    it('stays open for a press on its own segment', () => {
      renderWithIcons(<Timeline {...base} tracks={threeKeys()} />);
      openPicker();
      fireEvent.pointerDown(screen.getAllByTestId('timeline-segment')[0], { clientX: 100, button: 0 });
      expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    });

    it('closes on Escape, and leaves an Escape with nothing to close alone', () => {
      renderWithIcons(<Timeline {...base} tracks={threeKeys()} />);
      const root = screen.getByTestId('timeline-root');
      expect(fireEvent.keyDown(root, { key: 'Escape' })).toBe(true);
      openPicker();
      expect(fireEvent.keyDown(root, { key: 'Escape' })).toBe(false);
      expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
    });
  });

  it('renders the consumer’s key editor for the selection', () => {
    renderWithIcons(
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
    renderWithIcons(
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
    renderWithIcons(<Timeline {...base} tracks={nestedTracks()} />);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(2);
  });

  it("names a nested timeline's disclosure by its row's label", () => {
    renderWithIcons(<Timeline {...base} tracks={nestedTracks()} />);
    expect(screen.getByRole('button', { name: 'blink', expanded: false })).toBe(screen.getByTestId('timeline-disclosure'));
  });

  it('drags a key inside an expanded nested timeline', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={nestedTracks()} onChange={onChange} />);
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
    renderWithIcons(<Timeline {...base} tracks={nestedTracks()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 10 });
    onChange.mockClear();
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    expect(nestedKeyTimes(onChange.mock.calls[0][0] as Track[])).toEqual([300]);
  });

  it('snaps a nested key against ruler times, not track-local ones', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={nestedTracks()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    // The sibling key is local 300, ruler 400 — 200px in. Dropped 4px shy of
    // it, inside the 6px snap radius, so it lands exactly on it.
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 196, clientY: 10 });
    expect(nestedKeyTimes(onChange.mock.calls[0][0] as Track[])).toEqual([300, 300]);
  });

  it('snaps a dragged key to an event crossing on another row', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    // The event at 250 sits 125px in; dropped 3px shy of it, the key lands on it.
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 122, clientY: 10 });
    expect(((onChange.mock.calls[0][0] as Track[])[0] as SampledTrack<number>).keys.map((k) => k.t)).toEqual([250, 500]);
  });

  it('deletes nothing for Delete once the selected key’s row is folded away', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={nestedTracks()} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 10 });
    const disclosure = screen.getByTestId('timeline-disclosure');
    fireEvent.click(disclosure);
    disclosure.focus();
    fireEvent.keyDown(disclosure, { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drops a selection on a row it folds away, and edits no key on a row not drawn', () => {
    const onSelectionChange = vi.fn();
    const renderKeyEditor = () => <span data-testid="key-editor" />;
    const { rerender } = renderWithIcons(
      <Timeline {...base} tracks={nestedTracks()} onSelectionChange={onSelectionChange} renderKeyEditor={renderKeyEditor} />,
    );
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 10 });
    expect(screen.getByTestId('key-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByTestId('key-editor')).not.toBeInTheDocument();
    rerender(<Timeline {...base} tracks={nestedTracks()} selection={{ trackPath: [0, 0], keyIndex: 0 }} renderKeyEditor={renderKeyEditor} />);
    expect(screen.queryByTestId('key-editor')).not.toBeInTheDocument();
  });

  it('drops a segment selection on a row it folds away', () => {
    renderWithIcons(<Timeline {...base} tracks={nestedTracks()} />);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    fireEvent.click(screen.getAllByTestId('timeline-segment')[0]);
    expect(screen.getByTestId('easing-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    expect(screen.queryByTestId('easing-preview')).not.toBeInTheDocument();
  });

  it('deletes nothing for Delete on a selected key the tracks no longer hold', () => {
    const onChange = vi.fn();
    const three = [
      { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 100, value: 1 }, { t: 200, value: 2 }], onTick: () => {} },
    ] as Track[];
    const { rerender } = renderWithIcons(<Timeline {...base} tracks={three} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[2], { clientX: 200, button: 0 });
    fireEvent.pointerUp(document, { clientX: 200 });
    const two = [{ ...three[0], keys: (three[0] as SampledTrack<number>).keys.slice(0, 2) }] as Track[];
    rerender(<Timeline {...base} tracks={two} onChange={onChange} />);
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves focus where it is after a key press that changed nothing, when the timeline next renders', () => {
    const onChange = vi.fn();
    const props = { ...base, tracks: tracks(), onChange };
    const { rerender } = renderWithIcons(<Timeline {...props} />);
    const keys = () => screen.getAllByTestId('timeline-key');
    const event = () => screen.getByTestId('timeline-event');
    fireEvent.pointerDown(keys()[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    const tries: [() => HTMLElement, string][] = [[() => keys()[0], 'ArrowLeft'], [event, 'Delete']];
    for (const [at, key] of tries) {
      at().focus();
      fireEvent.keyDown(at(), { key });
      rerender(<Timeline {...props} playhead={props.playhead + 1} />);
      expect(document.activeElement, key).toBe(at());
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('puts back its preview and cancels a key drag released on its own time', () => {
    const input = [{ kind: 'sampled', label: 'hold', keys: [{ t: 500, value: 1 }, { t: 500, value: 2 }], onTick: () => {} }] as Track[];
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onCancel = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={input} onInput={onInput} onChange={onChange} onCancel={onCancel} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 250, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 250, clientY: 10 });
    expect(onChange).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect((onInput.mock.calls.at(-1)![0][0] as SampledTrack<number>).keys.map((k) => k.value)).toEqual([1, 2]);
  });

  it('keeps refusing keyboard edits while a key drag is held, though another finger lifts', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    const key = screen.getAllByTestId('timeline-key')[1];
    fireEvent.pointerDown(key, { pointerId: 1, pointerType: 'touch', clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerDown(screen.getAllByTestId('timeline-lane-track')[1], { pointerId: 2, pointerType: 'touch', clientX: 50, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { pointerId: 2, pointerType: 'touch', clientX: 50, clientY: 10 });
    fireEvent.pointerMove(document, { pointerId: 3, pointerType: 'mouse', clientX: 50, clientY: 10, buttons: 0 });
    fireEvent.keyDown(key, { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Timeline Delete away from the lanes', () => {
  it('deletes no key for a Delete or Backspace on the transport, the Graph switch, or the key editor', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <Timeline
        {...base} tracks={tracks()} onChange={onChange}
        transport={{ playing: false, loop: false, rate: 1, onPlayingChange: () => {}, onLoopChange: () => {}, onRateChange: () => {} }}
        renderKeyEditor={() => <button type="button" data-testid="swatch">swatch</button>}
      />,
    );
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    fireEvent.keyDown(screen.getByRole('switch', { name: 'Graph mode' }), { key: 'Delete' });
    fireEvent.keyDown(screen.getByTestId('swatch'), { key: 'Backspace' });
    fireEvent.keyDown(screen.getByRole('button', { name: /play/i }), { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Timeline keys held inside the duration', () => {
  const nearEnd = (): Track[] => ([
    { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 995, value: 10 }], onTick: () => {} },
  ] as Track[]);
  const keyTimes = (fn: ReturnType<typeof vi.fn>): number[] =>
    ((fn.mock.lastCall![0] as Track[])[0] as SampledTrack<number>).keys.map((k) => k.t);

  it('drops a key dragged past the lane\'s end at the duration', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 700, clientY: 10, altKey: true });
    fireEvent.pointerUp(document, { clientX: 700, clientY: 10, altKey: true });
    expect(keyTimes(onChange)).toEqual([0, 1000]);
  });

  it('steps a key no further than the duration', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={nearEnd()} onChange={onChange} />);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'ArrowRight' });
    expect(keyTimes(onChange)).toEqual([0, 1000]);
  });

  it('inserts no key past the duration', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    fireEvent.doubleClick(screen.getAllByTestId('timeline-lane-track')[0], { clientX: 800 });
    expect(keyTimes(onChange)).toEqual([0, 500, 1000]);
  });

  it('steps a graphed key no further than the duration', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} mode="graph" tracks={nearEnd()} onChange={onChange} />);
    fireEvent.keyDown(document.querySelectorAll('[data-keyframe-index]')[1], { key: 'ArrowRight' });
    expect(keyTimes(onChange)).toEqual([0, 1000]);
  });
});

describe('Timeline insert on an empty track', () => {
  const colors = (): Track[] => ([{ kind: 'sampled', label: 'fill', keys: [], interpolate: (a: string) => a, onTick: () => {} }] as unknown as Track[]);

  it('reports no edit for a double-click on an empty track it cannot seed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={colors()} onChange={onChange} />);
    fireEvent.doubleClick(screen.getByTestId('timeline-lane-track'), { clientX: 100 });
    expect(onChange).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('seeds it through seedKey', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={colors()} onChange={onChange} seedKey={() => '#000'} />);
    fireEvent.doubleClick(screen.getByTestId('timeline-lane-track'), { clientX: 100 });
    expect(((onChange.mock.lastCall![0] as Track[])[0] as SampledTrack<string>).keys).toEqual([{ t: 200, value: '#000' }]);
  });
});

describe('Timeline selection under tracks edited from outside', () => {
  it('deletes nothing for Delete once a key the consumer inserted moved the selected index onto another key', () => {
    const onChange = vi.fn();
    const onSelectionChange = vi.fn();
    const { rerender } = renderWithIcons(<Timeline {...base} tracks={tracks()} onChange={onChange} onSelectionChange={onSelectionChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    const inserted = tracks();
    (inserted[0] as SampledTrack<number>).keys.splice(1, 0, { t: 100, value: 2 });
    rerender(<Timeline {...base} tracks={inserted} onChange={onChange} onSelectionChange={onSelectionChange} />);
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the selection across its own move echoed back', () => {
    function Echo() {
      const [value, setValue] = useState(tracks);
      return <Timeline {...base} tracks={value} onChange={setValue} onInput={setValue} />;
    }
    renderWithIcons(<Echo />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 10, altKey: true });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 10, altKey: true });
    expect(screen.getAllByTestId('timeline-key')[1]).toHaveAttribute('aria-current', 'true');
  });
});

describe('Timeline key drags echoed through onInput', () => {
  function Echo({ onInput }: { onInput?: (next: Track[]) => void }) {
    const [value, setValue] = useState(tracks);
    return (
      <Timeline
        {...base} tracks={value} onChange={setValue}
        onInput={(next) => { onInput?.(next); setValue(next); }}
      />
    );
  }
  const keyTimes = (out: Track[]): number[] => (out[0] as SampledTrack<number>).keys.map((k) => k.t);

  it('does not snap a dragged key back onto its own previewed time', () => {
    const onInput = vi.fn();
    renderWithIcons(<Echo onInput={onInput} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 10 });
    // 3px past the last preview, inside the snap radius of it.
    fireEvent.pointerMove(document, { clientX: 303, clientY: 10 });
    expect(keyTimes(onInput.mock.lastCall![0] as Track[])).toEqual([0, 606]);
  });
});

describe('Timeline folds under tracks inserted from outside', () => {
  it('keeps an open nested row open, and a shut one shut, when the consumer inserts a track before them', () => {
    const second = { ...nestedTracks()[0], label: 'wink' } as Track;
    const { rerender } = renderWithIcons(<Timeline {...base} tracks={[...nestedTracks(), second]} />);
    fireEvent.click(screen.getAllByTestId('timeline-disclosure')[0]);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(3);
    rerender(<Timeline {...base} tracks={[tracks()[1], ...nestedTracks(), second]} />);
    expect(screen.getAllByTestId('timeline-disclosure').map((d) => d.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(4);
  });
});
