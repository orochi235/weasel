/**
 * A stateful property test of `useVisibleRaf` against a model of its gate, in and out of StrictMode: long runs of
 * requests, cancels, the document hiding and showing, the target leaving and entering the viewport, the escape
 * hatch flipping, an unmount, and frames over time jumps from none to past an hour, with frames that re-request,
 * do nothing, or hide the document before re-requesting. After every step: a frame is queued exactly when one is
 * owed and the gate is open, frames run only through an open gate, `onSuspend` and `onResume` alternate on each
 * change of the gate, and a loop rebasing its clock in `onResume` never measures a frame across a suspension.
 */
import { StrictMode, useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { useVisibleRaf, type VisibleRaf, type VisibleRafOptions } from './useVisibleRaf';
import { runs, tally, timeoutFor } from './pbt.fixture';

type FrameAct = 'none' | 'request' | 'hide-then-request';

interface Model {
  hidden: boolean;
  intersecting: boolean;
  escape: boolean;
  pending: boolean;
  alive: boolean;
  unmountedSuspended: boolean;
  frameAct: FrameAct;
  suspends: number;
  resumes: number;
  frames: number;
  /** The time of the last frame, unless the gate closed since. */
  measuredFrom: number | null;
}

interface World {
  loop: () => VisibleRaf;
  queued: Map<number, FrameRequestCallback>;
  clock: { time: number };
  setHidden(next: boolean): void;
  setIntersecting(next: boolean): void;
  setEscape(next: boolean): void;
  unmount(): void;
  /** What the hook reported: its callbacks and the frames' measured intervals. */
  seen: { suspends: number; resumes: number; frames: number; dts: (number | null)[] };
}

const open = (m: Model) => m.escape || (!m.hidden && m.intersecting);
const counts = tally();

function check(m: Model, w: World): void {
  expect(w.queued.size).toBe(m.alive && m.pending && open(m) ? 1 : 0);
  expect(w.seen.suspends).toBe(m.suspends);
  expect(w.seen.resumes).toBe(m.resumes);
  expect(w.seen.frames).toBe(m.frames);
  // An unmount ends a suspension without a resume.
  expect(m.suspends - m.resumes).toBe((m.alive ? !open(m) : m.unmountedSuspended) ? 1 : 0);
  if (m.alive) expect(w.loop().isVisible()).toBe(open(m));
}

/** The gate after a change the hook hears of: a suspend or a resume when it moved. */
function gate(m: Model, before: boolean): void {
  if (!m.alive) return;
  const now = open(m);
  if (before && !now) {
    m.suspends++;
    m.measuredFrom = null;
  } else if (!before && now) m.resumes++;
}

type Cmd = fc.Command<Model, World>;
const cmd = (name: string, apply: (m: Model, w: World) => void): Cmd => ({
  check: () => true,
  run(m, w) {
    counts.add(name);
    apply(m, w);
    check(m, w);
  },
  toString: () => name,
});

const request = cmd('request', (m, w) => {
  if (m.alive) act(() => w.loop().request());
  if (m.alive) m.pending = true;
});
const cancel = cmd('cancel', (m, w) => {
  if (m.alive) act(() => w.loop().cancel());
  m.pending = false;
});
const hide = (next: boolean) => cmd(`hidden=${next}`, (m, w) => {
  const before = open(m);
  act(() => w.setHidden(next));
  m.hidden = next;
  gate(m, before);
});
const intersect = (next: boolean) => cmd(`intersecting=${next}`, (m, w) => {
  const before = open(m);
  act(() => w.setIntersecting(next));
  if (!m.alive) return;
  m.intersecting = next;
  gate(m, before);
});
const escape = (next: boolean) => cmd(`escape=${next}`, (m, w) => {
  if (!m.alive) return;
  const before = open(m);
  act(() => w.setEscape(next));
  m.escape = next;
  gate(m, before);
});
const frameAct = (next: FrameAct) => cmd(`frame:${next}`, (m) => { m.frameAct = next; });
const flush = (jump: number) => cmd(`flush(${jump})`, (m, w) => {
  const time = (w.clock.time += jump);
  const due = [...w.queued.values()];
  w.queued.clear();
  act(() => { for (const cb of due) cb(time); });
  if (!(m.alive && m.pending && open(m))) return;
  counts.add('frame');
  m.frames++;
  expect(w.seen.dts.at(-1)).toBe(m.measuredFrom === null ? null : time - m.measuredFrom);
  m.measuredFrom = time;
  m.pending = false;
  if (m.frameAct === 'hide-then-request') {
    const before = open(m);
    m.hidden = true;
    gate(m, before);
  }
  if (m.frameAct !== 'none') m.pending = true;
});
/** Unmounts on one pick in five, so most runs live long. */
const unmount = (pick: number) => cmd(pick === 0 ? 'unmount' : 'unmount-skipped', (m, w) => {
  if (!m.alive || pick !== 0) return;
  act(() => w.unmount());
  m.unmountedSuspended = !open(m);
  m.alive = false;
  m.pending = false;
});

function Host({ loopRef, frame, options }: {
  loopRef: { current: VisibleRaf | null };
  frame: (t: number, loop: VisibleRaf) => void;
  options: VisibleRafOptions;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  loopRef.current = useVisibleRaf(frame, { ...options, target: ref });
  return <div ref={ref} />;
}

function world(strict: boolean, m: Model): World {
  let hidden = false;
  const callbacks: IntersectionObserverCallback[] = [];
  let observed: Element[] = [];
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { callbacks.push(cb); }
    observe(el: Element) { observed.push(el); }
    unobserve(el: Element) { observed = observed.filter((o) => o !== el); }
    disconnect() { observed = []; }
  });
  const queued = new Map<number, FrameRequestCallback>();
  let next = 1;
  const seen: World['seen'] = { suspends: 0, resumes: 0, frames: 0, dts: [] };
  let last: number | null = null;
  const loopRef = { current: null as VisibleRaf | null };
  const frame = (time: number, loop: VisibleRaf) => {
    seen.frames++;
    seen.dts.push(last === null ? null : time - last);
    last = time;
    if (m.frameAct === 'hide-then-request') {
      hidden = true;
      document.dispatchEvent(new Event('visibilitychange'));
    }
    if (m.frameAct !== 'none') loop.request();
  };
  const options = (escapeHatch: boolean): VisibleRafOptions => ({
    requestFrame: (cb) => {
      queued.set(next, cb);
      return next++;
    },
    cancelFrame: (id) => { queued.delete(id); },
    onSuspend: () => { seen.suspends++; },
    onResume: () => {
      seen.resumes++;
      last = null;
    },
    dangerouslyRunWhenHidden: escapeHatch,
  });
  const tree = (escapeHatch: boolean) => {
    const host = <Host loopRef={loopRef} frame={frame} options={options(escapeHatch)} />;
    return strict ? <StrictMode>{host}</StrictMode> : host;
  };
  const view = render(tree(false));
  return {
    loop: () => loopRef.current!,
    queued,
    clock: { time: 0 },
    setHidden(nextHidden) {
      hidden = nextHidden;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    setIntersecting(nextIntersecting) {
      for (const cb of callbacks) cb([{ isIntersecting: nextIntersecting, target: observed.at(-1) } as IntersectionObserverEntry], null as never);
    },
    setEscape: (escapeHatch) => view.rerender(tree(escapeHatch)),
    unmount: () => view.unmount(),
    seen,
  };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useVisibleRaf against a model of its gate', () => {
  it('queues, runs, suspends, and resumes as the model does through long runs', () => {
    const jump = fc.oneof(fc.constantFrom(0, 16, 1000, 3_600_000, 86_400_000 * 365), fc.double({ min: 0, max: 100, noNaN: true }));
    const commands = fc.commands([
      fc.constant(request), fc.constant(request), fc.constant(cancel),
      fc.boolean().map(hide), fc.boolean().map(intersect), fc.boolean().map(escape),
      fc.constantFrom<FrameAct>('none', 'request', 'request', 'hide-then-request').map(frameAct),
      jump.map(flush), jump.map(flush), jump.map(flush),
      fc.nat({ max: 4 }).map(unmount),
    ], { maxCommands: 80 });
    fc.assert(fc.property(fc.boolean(), commands, (strict, cmds) => {
      cleanup();
      const m: Model = {
        hidden: false, intersecting: true, escape: false, pending: false, alive: true, unmountedSuspended: false, frameAct: 'request',
        suspends: 0, resumes: 0, frames: 0, measuredFrom: null,
      };
      const w = world(strict, m);
      fc.modelRun(() => ({ model: m, real: w }), cmds);
    }), runs(150));
    for (const k of ['frame', 'hidden=true', 'intersecting=false', 'escape=true', 'cancel', 'frame:hide-then-request']) {
      expect(counts.get(k), k).toBeGreaterThan(10);
    }
    expect(counts.get('unmount')).toBeGreaterThan(10);
  }, timeoutFor(150, 80));
});
