import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import type { SampledTrack, TimelineTrack, Track } from '@weasel-js/animator';
import { Timeline } from './Timeline';

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 500, bottom: 20, width: 500, height: 20, toJSON: () => {} } as DOMRect;
  };
});

const base = { duration: 1000, playhead: 0, onChange: () => {}, onSeek: () => {} };

/** A top-level key at ruler 590, and a nested timeline starting at ruler 600 holding `keys`. */
const nestedAfterKey = (keys: number[]): Track[] => ([
  { kind: 'sampled', label: 'a', keys: [{ t: 590, value: 0 }], onTick: () => {} },
  {
    kind: 'timeline', label: 'blink', at: 600,
    timeline: { tracks: [{ kind: 'sampled', label: 'o', keys: keys.map((t) => ({ t, value: 0 })), onTick: () => {} }] },
  },
] as unknown as Track[]);

const nestedKeys = (out: Track[]): number[] =>
  ((out[1] as TimelineTrack).timeline.tracks[0] as SampledTrack<number>).keys.map((k) => k.t);

const childKeys = () => within(screen.getAllByTestId('timeline-lane-track').at(-1)!).getAllByTestId('timeline-key');

describe('Timeline key drags snap only to stops the key can reach', () => {
  it('draws the ghost where a nested key lands, not on a stop before the row starts', () => {
    const onChange = vi.fn();
    renderWithIcons(<Timeline {...base} tracks={nestedAfterKey([50, 200])} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('timeline-disclosure'));
    // 2 ms a pixel: the key at ruler 800 dragged to ruler 580 holds at the row's start, 600, 10 ms from the 590 stop.
    fireEvent.pointerDown(childKeys()[1]!, { clientX: 400, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 290, clientY: 10 });
    expect(screen.getByTestId('timeline-key-ghost').style.left).toBe('60%');
    fireEvent.pointerUp(document, { clientX: 290, clientY: 10 });
    expect(nestedKeys(onChange.mock.calls[0][0] as Track[])).toEqual([0, 50]);
  });

});

const plain = (): Track[] => ([
  { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} },
  { kind: 'sampled', label: 'y', keys: [{ t: 100, value: 0 }], onTick: () => {} },
] as Track[]);

const keyTimes = (out: Track[], i = 0): number[] => (out[i] as SampledTrack<number>).keys.map((k) => k.t);

describe('Timeline key drags under a hold that starts mid-drag', () => {
  it.each([{ readOnly: true }, { disabled: true }])('%o cancels the drag, puts its preview back, and commits nothing', (held) => {
    const calls = { onInput: vi.fn(), onChange: vi.fn(), onCancel: vi.fn() };
    const tracks = plain();
    const { rerender } = renderWithIcons(<Timeline {...base} tracks={tracks} {...calls} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1]!, { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10 });
    rerender(<Timeline {...base} tracks={tracks} {...calls} {...held} />);
    fireEvent.pointerMove(document, { clientX: 400, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(calls.onChange).not.toHaveBeenCalled();
    expect(calls.onCancel).toHaveBeenCalledTimes(1);
    expect(keyTimes(calls.onInput.mock.calls.at(-1)![0] as Track[])).toEqual([0, 500]);
    expect(screen.queryByTestId('timeline-key-ghost')).toBeNull();
  });
});
