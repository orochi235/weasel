/**
 * Page half of `compositor-handoff.spec.ts`: `count` elements, each tweened by one weasel
 * animator, either handed to `Element.animate` or shown from the main thread. Loaded into a
 * blank page through vite (`/weasel/@fs…/tests/perf/lib/compositorHandoff.page.ts`).
 */
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createElementTarget, type Animator } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';

export type Approach = 'main' | 'compositor';

/** `drift`: one straight run across, moving and fading. `slide`: the same move with no fade, so
 *  one property. `wave`: sweeps back and forth, a keyframe at every turn — the many-keyframe case. */
export type Shape = 'drift' | 'slide' | 'wave';

export interface Cell {
  approach: Approach;
  count: number;
  shape: Shape;
}

export interface FrameStats {
  /** rAF timestamps' intervals over the window, ms. */
  intervals: number[];
  /** Live animations on the compositor path when the window closed. */
  onCompositor: number;
  /** Live animations at all when the window closed. */
  live: number;
}

const W = 1280;
const H = 800;
/** Each element's run: long enough to outlast warmup and every window of a cell, even at a few
 *  frames a second. */
const RUN_MS = 120_000;
/** Sweeps over the run: one every two seconds. */
const SWEEPS = RUN_MS / 2000;

/** A triangle wave, -1 to 1 and back once per unit of `x`. */
const wave = (x: number): number => 1 - 4 * Math.abs(x - Math.floor(x + 0.5));

let root: Root | null = null;
let animator: Animator | null = null;
const stage = (): HTMLElement => document.getElementById('stage')!;

function Host({ ready }: { ready: (a: Animator) => void }) {
  const a = useAnimator();
  useEffect(() => { ready(a); }, [a, ready]);
  return null;
}

/** Tears the last cell down and starts `cell`: `count` dots, each sweeping its own way. */
export async function setup(cell: Cell): Promise<{ painted: boolean; startMs: number; keyframes: number }> {
  animator?.cancelAll();
  root?.unmount();
  stage().replaceChildren();
  const holder = document.createElement('div');
  document.body.appendChild(holder);
  animator = await new Promise<Animator>((resolve) => {
    root = createRoot(holder);
    root.render(createElement(Host, { ready: resolve }));
  });
  const started = performance.now();
  const cols = Math.ceil(Math.sqrt((cell.count * W) / H));
  for (let i = 0; i < cell.count; i++) {
    const el = document.createElement('div');
    el.className = 'dot';
    el.style.left = `${(i % cols) * (W / cols)}px`;
    el.style.top = `${Math.floor(i / cols) * (W / cols)}px`;
    stage().appendChild(el);
    const target = createElementTarget({
      element: el,
      value: { x: 0, y: 0, o: 1 },
      style: cell.shape === 'slide'
        ? (v) => ({ transform: `translate(${v.x}px, ${v.y}px)` })
        : (v) => ({ transform: `translate(${v.x}px, ${v.y}px)`, opacity: v.o }),
    });
    const angle = (i * 2.399) % (2 * Math.PI);
    // Sweeps back and forth across one long run, so the motion changes every frame of every
    // window. A triangle wave is straight between its turns, so its keyframes are the turns.
    animator.tween({
      target,
      to: { x: 0, y: 0, o: 1 },
      ms: RUN_MS,
      easing: 'linear',
      interpolator: () => (u) => {
        const s = cell.shape === 'wave' ? wave(u * SWEEPS + i / 7) : 2 * u - 1;
        return { x: 60 * s * Math.cos(angle), y: 60 * s * Math.sin(angle), o: 0.6 + 0.4 * Math.abs(s) };
      },
      compositor: cell.approach === 'compositor' ? 'require' : 'off',
    });
  }
  const startMs = performance.now() - started;
  const anims = stage().firstElementChild?.getAnimations() ?? [];
  const keyframes = anims.length ? (anims[0]!.effect as KeyframeEffect).getKeyframes().length : 0;
  await frames(2);
  const first = stage().firstElementChild;
  return { painted: !!first && first.getBoundingClientRect().width > 0, startMs, keyframes };
}

const frames = (n: number): Promise<number[]> => new Promise((done) => {
  const stamps: number[] = [];
  // A probe of the page's frame rate, not an animation: it stops itself after `n`.
  const tick = (t: number) => {
    stamps.push(t);
    if (stamps.length >= n) done(stamps);
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

/** The page's own frames over `n` of them; or, given `mark`, `n` frames' time at 60 Hz between two
 *  marks a trace can find, with no frame asked for: a page frame loop of its own would make the
 *  browser run the main thread's frame every vsync, which a compositor animation does not need. */
export async function measure(n: number, mark: string | null): Promise<FrameStats> {
  let stamps: number[] = [];
  if (mark) {
    performance.mark(`${mark}-start`);
    await wait((n * 1000) / 60);
    performance.mark(`${mark}-end`);
  } else stamps = await frames(n + 1);
  const live = animator?.live() ?? [];
  return {
    intervals: stamps.slice(1).map((t, i) => t - stamps[i]!),
    onCompositor: live.filter((r) => r.compositor).length,
    live: live.length,
  };
}

export const wait = (ms: number): Promise<void> => new Promise((done) => { setTimeout(done, ms); });

export function teardown(): void {
  animator?.cancelAll();
  root?.unmount();
  root = null;
  animator = null;
  stage().replaceChildren();
}
