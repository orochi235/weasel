import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../../../useAnimator';
import { createElementTarget } from '../../../elementTarget';

type Frame = Record<string, string | number>;

/**
 * `Element.animate`'s timing as the Web Animations spec has it, on a timeline the test moves:
 * enough to read where a browser would show a handed-off run. jsdom has no `animate` at all.
 */
export class FakeAnimation {
  canceled = false;
  onfinish: (() => void) | null = null;
  private done = false;
  private rate = 1;
  private start: number | null = null;
  private hold: number | null = 0;
  constructor(readonly keyframes: Frame[], readonly duration: number, private readonly timeline: { now: number }) {}
  get playbackRate(): number { return this.rate; }
  set playbackRate(r: number) {
    const t = this.currentTime;
    this.rate = r;
    if (this.hold === null) this.start = this.timeline.now - t / r;
  }
  get startTime(): number | null { return this.start; }
  set startTime(t: number | null) {
    this.start = t;
    if (t !== null) this.hold = null;
  }
  get currentTime(): number {
    if (this.hold !== null) return this.hold;
    return (this.timeline.now - this.start!) * this.rate;
  }
  set currentTime(t: number) {
    if (this.hold !== null) this.hold = t;
    else this.start = this.timeline.now - t / this.rate;
  }
  get paused(): boolean { return this.hold !== null; }
  pause(): void { this.hold = this.currentTime; }
  cancel(): void { this.canceled = true; }

  /** Fires `finish` once its current time has passed its end, or its start played backward. */
  advance(): void {
    if (this.canceled || this.done || this.hold !== null) return;
    const t = this.currentTime;
    if ((this.rate > 0 && t >= this.duration) || (this.rate < 0 && t <= 0)) {
      this.done = true;
      this.onfinish?.();
    }
  }

  /** The `translateX` its keyframes show at its current time, as a browser blends them. */
  shownX(): number {
    const t = Math.min(this.duration, Math.max(0, this.currentTime)) / this.duration;
    const ks = this.keyframes;
    let i = 0;
    while (i < ks.length - 2 && Number(ks[i + 1]!.offset) < t) i++;
    const x = (k: Frame): number => Number(/translateX\((-?[\d.e+-]+)px\)/.exec(String(k.transform))![1]);
    const o0 = Number(ks[i]!.offset);
    const o1 = Number(ks[i + 1]!.offset);
    return x(ks[i]!) + (x(ks[i + 1]!) - x(ks[i]!)) * ((t - o0) / (o1 - o0));
  }
}

/** A frame clock the test advances, the timeline the fakes read, and an animator on them. */
export function setup() {
  let now = 0;
  const timeline = { now: 0, animations: [] as FakeAnimation[] };
  const callbacks = new Map<number, (t: number) => void>();
  let next = 1;
  const clock = {
    now: () => now,
    requestFrame: (cb: (t: number) => void): number => { callbacks.set(next, cb); return next++; },
    cancelFrame: (h: number): void => { callbacks.delete(h); },
  };
  const { result, unmount } = renderHook(() => useAnimator(clock));
  /** Runs the frame `ms` from the last; the timeline moves with it. */
  const step = (ms: number): void => act(() => {
    now += ms;
    timeline.now = now;
    for (const a of timeline.animations) a.advance();
    const due = [...callbacks.values()];
    callbacks.clear();
    for (const cb of due) cb(now);
  });
  return { animator: result.current, unmount, step, timeline, pending: () => callbacks.size };
}

/** An element target over `{ x }`, shown as a `translateX`, whose `animate` makes fakes. */
export function element(timeline: { now: number; animations?: FakeAnimation[] }, x = 0, extra: Frame = {}) {
  const el = document.createElement('div');
  const made: FakeAnimation[] = [];
  let styled = 0;
  (el as unknown as { animate: unknown }).animate = (frames: Frame[], o: { duration: number }) => {
    const a = new FakeAnimation(frames, o.duration, timeline);
    made.push(a);
    timeline.animations?.push(a);
    return a;
  };
  const target = createElementTarget({
    element: el,
    value: { x },
    style: (v) => { styled += 1; return { transform: `translateX(${v.x}px)`, ...extra }; },
  });
  return {
    el,
    target,
    made,
    /** The latest browser animation made for it. */
    last: (): FakeAnimation => made[made.length - 1]!,
    /** How many times its style has been asked for, keyframes and inline writes alike. */
    styled: () => styled,
    inlineX: (): number => Number(/translateX\((-?[\d.e+-]+)px\)/.exec(el.style.transform)?.[1] ?? NaN),
  };
}
