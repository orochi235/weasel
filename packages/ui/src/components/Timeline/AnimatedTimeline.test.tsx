import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { SampledTrack, TimelineHandle, Track } from '@weasel-js/core';
import { AnimatedTimeline } from './AnimatedTimeline';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 20,
      width: TRACK_WIDTH, height: 20, toJSON: () => {},
    } as DOMRect;
  };
});

/** A stand-in with the live-array semantics `createTimeline` actually has:
 *  `tracks()` returns the same array object every call, and `edit` runs the
 *  mutation against it. A fake returning a copy would make the splice below a
 *  no-op and the test would still pass, which is the bug this guards. */
function fakeHandle(over: Partial<TimelineHandle> = {}): TimelineHandle & { live: Track[] } {
  const live: Track[] = [
    { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} } as Track,
  ];
  let t = 0;
  let paused = true;
  return {
    live,
    id: 1,
    cancel: vi.fn(), pause: vi.fn(() => { paused = true; }), resume: vi.fn(() => { paused = false; }),
    setTimeScale: vi.fn(), isPaused: () => paused,
    seek: vi.fn((to: number) => { t = to; }),
    time: () => t,
    duration: () => 1000,
    tracks: () => live,
    edit: vi.fn((fn: () => void) => { fn(); }),
    subscribe: () => () => {},
    setLoop: vi.fn(),
    ...over,
  } as TimelineHandle & { live: Track[] };
}

describe('AnimatedTimeline', () => {
  it('renders the handle’s tracks', () => {
    render(<AnimatedTimeline handle={fakeHandle()} />);
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
  });

  it('routes an edit through edit(), mutating the live array in place', () => {
    const h = fakeHandle();
    const before = h.tracks();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(h.edit).toHaveBeenCalledTimes(1);
    expect(h.tracks()).toBe(before);
    expect((h.tracks()[0] as SampledTrack<number>).keys[1].t).toBe(800);
  });

  it('scrubs through seek', () => {
    const h = fakeHandle();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.pointerDown(screen.getByTestId('timeline-ruler'), { clientX: 250, clientY: 5, button: 0 });
    expect(h.seek).toHaveBeenCalledWith(500);
  });

  it('resumes on play', () => {
    const h = fakeHandle();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.resume).toHaveBeenCalledTimes(1);
  });

  it('rewinds before resuming a timeline parked at its duration', () => {
    const h = fakeHandle({ time: () => 1000 });
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.seek).toHaveBeenCalledWith(0);
    expect(h.resume).toHaveBeenCalledTimes(1);
  });

  it('does not rewind a timeline mid-run', () => {
    const h = fakeHandle({ time: () => 400 });
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.seek).not.toHaveBeenCalled();
  });

  it('pauses on pause', () => {
    const h = fakeHandle({ isPaused: () => false });
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(h.pause).toHaveBeenCalledTimes(1);
  });

  it('routes the loop toggle to setLoop', () => {
    const h = fakeHandle();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(h.setLoop).toHaveBeenCalledWith(true);
  });

  it('routes the rate control to setTimeScale', () => {
    const h = fakeHandle();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.change(screen.getByLabelText(/rate/i), { target: { value: '2' } });
    expect(h.setTimeScale).toHaveBeenCalledWith(2);
  });
});
