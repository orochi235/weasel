import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import type { SampledTrack, TimelineHandle, Track } from '@weasel-js/animator';
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
  let loop: boolean | number = false;
  let scale = 1;
  const subscribers = new Set<() => void>();
  const playback = new Set<() => void>();
  const changed = (): void => { for (const cb of playback) cb(); };
  return {
    live,
    id: 1,
    cancel: vi.fn(), pause: vi.fn(() => { paused = true; changed(); }), resume: vi.fn(() => { paused = false; changed(); }),
    setTimeScale: vi.fn((s: number) => { scale = s; }),
    timeScale: () => scale,
    isPaused: () => paused,
    seek: vi.fn((to: number) => { t = to; changed(); }),
    time: () => t,
    duration: () => 1000,
    tracks: () => live,
    edit: vi.fn((fn: () => void) => { fn(); for (const cb of subscribers) cb(); }),
    subscribe: (cb: () => void) => { subscribers.add(cb); return () => { subscribers.delete(cb); }; },
    subscribePlayback: (cb: () => void) => { playback.add(cb); return () => { playback.delete(cb); }; },
    setLoop: vi.fn((next: boolean | number) => { loop = next; }),
    loop: () => loop,
    ...over,
  } as TimelineHandle & { live: Track[] };
}

describe('AnimatedTimeline', () => {
  it('renders the handle’s tracks', () => {
    renderWithIcons(<AnimatedTimeline handle={fakeHandle()} />);
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
  });

  it('routes an edit through edit(), mutating the live array in place', () => {
    const h = fakeHandle();
    const before = h.tracks();
    renderWithIcons(<AnimatedTimeline handle={h} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(h.edit).toHaveBeenCalledTimes(1);
    expect(h.tracks()).toBe(before);
    expect((h.tracks()[0] as SampledTrack<number>).keys[1].t).toBe(800);
  });

  it('redraws a key where an edit left it', () => {
    renderWithIcons(<AnimatedTimeline handle={fakeHandle()} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(screen.getAllByTestId('timeline-key')[1].style.left).toBe('80%');
  });

  it('scrubs through seek', () => {
    const h = fakeHandle();
    renderWithIcons(<AnimatedTimeline handle={h} />);
    fireEvent.pointerDown(screen.getByTestId('timeline-ruler'), { clientX: 250, clientY: 5, button: 0 });
    expect(h.seek).toHaveBeenCalledWith(500);
  });

  it('follows a resume, a pause, and a seek made on the handle from elsewhere', () => {
    const h = fakeHandle();
    renderWithIcons(<AnimatedTimeline handle={h} />);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();

    act(() => h.resume());
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    act(() => h.pause());
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();

    const playhead = (): string => screen.getByTestId('timeline-playhead').style.left;
    const before = playhead();
    act(() => h.seek(500));
    expect(playhead()).not.toBe(before);
  });

  it('stops listening to a handle it no longer shows', () => {
    const h = fakeHandle();
    const off = vi.fn();
    h.subscribePlayback = () => off;
    renderWithIcons(<AnimatedTimeline handle={h} />).unmount();
    expect(off).toHaveBeenCalledTimes(1);
  });

  it('resumes on play', () => {
    const h = fakeHandle();
    renderWithIcons(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.resume).toHaveBeenCalledTimes(1);
  });

  it('rewinds before resuming a timeline parked at its duration', () => {
    const h = fakeHandle({ time: () => 1000 });
    renderWithIcons(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.seek).toHaveBeenCalledWith(0);
    expect(h.resume).toHaveBeenCalledTimes(1);
  });

  it('does not rewind a timeline mid-run', () => {
    const h = fakeHandle({ time: () => 400 });
    renderWithIcons(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.seek).not.toHaveBeenCalled();
  });

  it('pauses on pause', () => {
    const h = fakeHandle({ isPaused: () => false });
    renderWithIcons(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(h.pause).toHaveBeenCalledTimes(1);
  });

  it('routes the loop toggle to setLoop', () => {
    const h = fakeHandle();
    renderWithIcons(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(h.setLoop).toHaveBeenCalledWith(true);
  });

  it('routes the rate control to setTimeScale', () => {
    const h = fakeHandle();
    renderWithIcons(<AnimatedTimeline handle={h} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: /rate/i }), { key: 'ArrowRight' });
    expect(h.setTimeScale).toHaveBeenCalledWith(2);
  });

  it('shows the loop and rate the handle reports, not what the transport set', () => {
    const h = fakeHandle({ loop: () => 3, timeScale: () => 4 });
    renderWithIcons(<AnimatedTimeline handle={h} />);
    expect(screen.getByRole('switch', { name: /loop/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('slider', { name: /rate/i })).toHaveAttribute('aria-valuetext', '4 times');
  });

  // The drift a mirrored copy caused: anything else holding the handle can set
  // these, and the transport has to show the handle's answer, not its own.
  it('picks up a loop or rate set off the component', () => {
    const h = fakeHandle();
    const { rerender } = renderWithIcons(<AnimatedTimeline handle={h} />);
    h.setLoop(true);
    h.setTimeScale(2);
    rerender(<AnimatedTimeline handle={h} />);
    expect(screen.getByRole('switch', { name: /loop/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('slider', { name: /rate/i })).toHaveAttribute('aria-valuetext', '2 times');
  });

  describe('frame loop', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    /** A frame clock the test turns by hand. */
    function manualFrames(): { queued: () => number; turn: () => void } {
      let queue: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb));
      vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
      return {
        queued: () => queue.length,
        turn: () => act(() => { const run = queue; queue = []; for (const cb of run) cb(0); }),
      };
    }

    it('keeps running while the timeline plays', () => {
      const frames = manualFrames();
      renderWithIcons(<AnimatedTimeline handle={fakeHandle({ isPaused: () => false, time: () => 400 })} />);
      frames.turn();
      frames.turn();
      expect(frames.queued()).toBe(1);
    });

    it('stops once a timeline that does not loop reaches its end', () => {
      const frames = manualFrames();
      renderWithIcons(<AnimatedTimeline handle={fakeHandle({ isPaused: () => false, time: () => 1000 })} />);
      frames.turn();
      frames.turn();
      expect(frames.queued()).toBe(0);
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    it('keeps running at the end of a timeline that loops', () => {
      const frames = manualFrames();
      renderWithIcons(<AnimatedTimeline handle={fakeHandle({ isPaused: () => false, time: () => 1000, loop: () => true })} />);
      frames.turn();
      expect(frames.queued()).toBe(1);
    });
  });
});
