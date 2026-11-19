/**
 * Counts what a mounted tree registers with something that outlives it — listeners, timers, frames, observers,
 * media-query listeners — so a teardown test can mount, unmount and check that the count went back down.
 *
 * A registration counts while its target is reachable without the component: `window`, `document`, a node still
 * in the document, or a media query list (the document keeps one alive while it has listeners). A listener on an
 * element the unmount took out of the document goes with that element, so it is not one.
 */
import { act } from '@testing-library/react';

export type LeakKind = 'listener' | 'timeout' | 'interval' | 'frame' | 'resize' | 'intersection' | 'mutation' | 'media';

export const LEAK_KINDS: readonly LeakKind[] = ['listener', 'timeout', 'interval', 'frame', 'resize', 'intersection', 'mutation', 'media'];

/** One registration still live: its kind, what it was made on, and where. */
export interface Live {
  kind: LeakKind;
  what: string;
  /** Where it was made. Formatted only when asked: formatting every registration's stack costs more than the tests. */
  stack(): string;
  /** Whether its target is still reachable without the tree that made it. */
  held(): boolean;
}

export interface LeakProbe {
  /** Every live registration whose target is reachable. */
  live(): Live[];
  /** Runs every timeout and frame callback pending, then the ones those queue, up to `rounds` deep. */
  flush(rounds?: number): void;
  /** Puts back everything the probe replaced. */
  restore(): void;
}

type Scope = typeof globalThis & Record<string, unknown>;

const stackHere = (): (() => string) => {
  const at = new Error();
  return () =>
    (at.stack ?? '')
      .split('\n')
      .slice(2)
      .filter((line) => !line.includes('node_modules') && !line.includes('leakProbe'))
      .slice(0, 6)
      .join('\n');
};

/** The target each registration made on one is held by, weakly: the probe keeps no element alive. */
const targetOf = new WeakMap<Live, WeakRef<object>>();

/** A registration on `target`, held while the target is alive and reachable. */
function onTarget(rec: Omit<Live, 'held'>, target: object): Live {
  const ref = new WeakRef(target);
  const live: Live = {
    ...rec,
    held: () => {
      const t = ref.deref();
      return t !== undefined && reachable(t);
    },
  };
  targetOf.set(live, ref);
  return live;
}

/** Whether `rec`'s target has been collected, so nothing can ever reach it again. */
const collected = (rec: Live): boolean => targetOf.get(rec)?.deref() === undefined && targetOf.has(rec);

function nameOf(target: unknown): string {
  if (typeof window !== 'undefined' && target === window) return 'window';
  if (typeof document !== 'undefined' && target === document) return 'document';
  if (typeof Element !== 'undefined' && target instanceof Element) {
    const cls = typeof target.className === 'string' && target.className ? `.${target.className.split(' ')[0]}` : '';
    return `<${target.tagName.toLowerCase()}${cls}>`;
  }
  return Object.prototype.toString.call(target);
}

function reachable(target: unknown): boolean {
  if (typeof window !== 'undefined' && target === window) return true;
  if (typeof document !== 'undefined' && target === document) return true;
  if (typeof Node !== 'undefined' && target instanceof Node) return target.isConnected;
  return false;
}

type Replace = <T extends object, K extends keyof T>(obj: T, key: K, value: T[K]) => void;

/** What each part of the probe patches through: the global scope, the live set, and a replacer `restore` undoes. */
interface Patch {
  scope: Scope;
  records: Set<Live>;
  replace: Replace;
}

/** A timer or frame callback still pending, kept so `flush` can run it now rather than wait out its delay. */
interface Pending {
  rec: Live;
  run: () => void;
  clear: () => void;
}

const always = () => true;

function watchListeners({ records, replace }: Patch): void {
  const proto = EventTarget.prototype;
  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  type Entry = { rec: Live; type: string; cb: EventListenerOrEventListenerObject; capture: boolean };
  // By target, held weakly: a story's elements come and go by the thousand, and none of them is the probe's to keep.
  const byTarget = new WeakMap<EventTarget, Entry[]>();
  const captureOf = (o?: boolean | EventListenerOptions): boolean => (typeof o === 'boolean' ? o : !!o?.capture);
  const find = (target: EventTarget, type: string, cb: EventListenerOrEventListenerObject, capture: boolean) =>
    byTarget.get(target)?.find((e) => e.type === type && e.cb === cb && e.capture === capture);
  const drop = (target: EventTarget, e: Entry): void => {
    const list = byTarget.get(target);
    const at = list?.indexOf(e) ?? -1;
    if (at >= 0) list!.splice(at, 1);
    records.delete(e.rec);
  };
  replace(proto, 'addEventListener', function (this: EventTarget, type, cb, options) {
    add.call(this, type, cb, options);
    if (!cb) return;
    const capture = captureOf(options);
    if (find(this, type, cb, capture)) return;
    const target = this;
    const rec = onTarget({ kind: 'listener', what: `${nameOf(target)} ${type}`, stack: stackHere() }, target);
    const entry: Entry = { rec, type, cb, capture };
    const list = byTarget.get(target) ?? [];
    byTarget.set(target, list);
    list.push(entry);
    records.add(rec);
    const opts = typeof options === 'object' ? options : undefined;
    if (opts?.once) add.call(target, type, () => drop(target, entry), { once: true, capture });
    if (opts?.signal) add.call(opts.signal, 'abort', () => drop(target, entry), { once: true });
  });
  replace(proto, 'removeEventListener', function (this: EventTarget, type, cb, options) {
    remove.call(this, type, cb, options);
    if (!cb) return;
    const entry = find(this, type, cb, captureOf(options));
    if (entry) drop(this, entry);
  });
}

function watchTimer(
  { scope, records, replace }: Patch,
  pending: Map<number, Pending>,
  kind: 'timeout' | 'interval',
  set: 'setTimeout' | 'setInterval',
  clear: 'clearTimeout' | 'clearInterval',
): void {
  const realSet = scope[set] as typeof setTimeout;
  const realClear = scope[clear] as typeof clearTimeout;
  replace(scope, set, ((cb: TimerHandler, ms?: number, ...args: unknown[]) => {
    const rec: Live = { kind, what: `${set}(${ms ?? 0})`, stack: stackHere(), held: always };
    const fire = () => {
      if (kind === 'timeout') {
        pending.delete(id);
        records.delete(rec);
      }
      if (typeof cb === 'function') (cb as (...a: unknown[]) => void)(...args);
    };
    const id = realSet(fire, ms) as unknown as number;
    pending.set(id, { rec, run: fire, clear: () => realClear(id) });
    records.add(rec);
    return id;
  }) as never);
  replace(scope, clear, ((id?: number) => {
    realClear(id);
    const p = id === undefined ? undefined : pending.get(id);
    if (p && p.rec.kind === kind) {
      pending.delete(id!);
      records.delete(p.rec);
    }
  }) as never);
}

function watchFrames({ scope, records, replace }: Patch, frames: Map<number, Pending>): void {
  const request = scope.requestAnimationFrame;
  if (typeof request !== 'function') return;
  const realRequest = request.bind(scope);
  const realCancel = scope.cancelAnimationFrame.bind(scope);
  replace(scope, 'requestAnimationFrame', (cb: FrameRequestCallback) => {
    const rec: Live = { kind: 'frame', what: 'animation frame', stack: stackHere(), held: always };
    const run = (time = performance.now()) => {
      frames.delete(id);
      records.delete(rec);
      cb(time);
    };
    const id = realRequest(run);
    frames.set(id, { rec, run, clear: () => realCancel(id) });
    records.add(rec);
    return id;
  });
  replace(scope, 'cancelAnimationFrame', (id: number) => {
    realCancel(id);
    const p = frames.get(id);
    if (p) {
      frames.delete(id);
      records.delete(p.rec);
    }
  });
}

interface Observer {
  observe?(...a: unknown[]): void;
  unobserve?(target: Node): void;
  disconnect?(): void;
  takeRecords?(): unknown[];
}

/** `Base`, counting each target it observes until it unobserves it or disconnects. */
function countingObserver(records: Set<Live>, kind: 'resize' | 'intersection' | 'mutation', Base: new (...a: never[]) => object): never {
  const watched = new WeakMap<object, Map<Node, Live>>();
  const forget = (obs: object, target?: Node) => {
    const map = watched.get(obs);
    if (!map) return;
    for (const [node, rec] of map) {
      if (target && node !== target) continue;
      records.delete(rec);
      map.delete(node);
    }
  };
  return class extends (Base as new (...a: unknown[]) => Observer) {
    observe(target: Node, ...rest: unknown[]): void {
      super.observe?.(target, ...rest);
      const map = watched.get(this) ?? new Map<Node, Live>();
      watched.set(this, map);
      if (map.has(target)) return;
      const rec = onTarget({ kind, what: `${kind} observe ${nameOf(target)}`, stack: stackHere() }, target);
      map.set(target, rec);
      records.add(rec);
    }
    unobserve(target: Node): void {
      super.unobserve?.(target);
      forget(this, target);
    }
    disconnect(): void {
      super.disconnect?.();
      forget(this);
    }
    takeRecords(): unknown[] {
      return super.takeRecords?.() ?? [];
    }
  } as never;
}

/** jsdom has no ResizeObserver or IntersectionObserver; the stand-ins never call back. */
class Inert {
  constructor(_cb?: unknown, _opts?: unknown) {}
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] {
    return [];
  }
}

function watchObservers({ scope, records, replace }: Patch): void {
  replace(scope, 'ResizeObserver', countingObserver(records, 'resize', Inert));
  replace(scope, 'IntersectionObserver', countingObserver(records, 'intersection', Inert));
  if (typeof scope.MutationObserver === 'function') {
    replace(scope, 'MutationObserver', countingObserver(records, 'mutation', scope.MutationObserver as never));
  }
}

/** jsdom has no matchMedia; this one never matches and never changes. */
function watchMedia({ scope, records, replace }: Patch): void {
  replace(scope, 'matchMedia', (query: string) => {
    const listeners = new Map<unknown, Live>();
    const on = (cb: unknown) => {
      if (!cb || listeners.has(cb)) return;
      const rec: Live = { kind: 'media', what: `matchMedia(${query})`, stack: stackHere(), held: always };
      listeners.set(cb, rec);
      records.add(rec);
    };
    const off = (cb: unknown) => {
      const rec = listeners.get(cb);
      if (!rec) return;
      listeners.delete(cb);
      records.delete(rec);
    };
    return {
      media: query,
      matches: false,
      onchange: null,
      addEventListener: (_: string, cb: unknown) => on(cb),
      removeEventListener: (_: string, cb: unknown) => off(cb),
      addListener: on,
      removeListener: off,
      dispatchEvent: () => false,
    };
  });
}

/** Runs every pending callback in `map` but an interval's, and says how many ran. */
function runAll(map: Map<number, Pending>): number {
  const due = [...map.values()].filter((p) => p.rec.kind !== 'interval');
  for (const p of due) {
    p.clear();
    p.run();
  }
  return due.length;
}

/** Install the probe. Everything registered from here on is tracked; call `restore` when done. */
export function installLeakProbe(): LeakProbe {
  const records = new Set<Live>();
  const undo: (() => void)[] = [];
  const replace: Replace = (obj, key, value) => {
    const had = Object.prototype.hasOwnProperty.call(obj, key);
    const prev = obj[key];
    obj[key] = value;
    undo.push(() => {
      if (had) obj[key] = prev;
      else delete obj[key];
    });
  };
  const patch: Patch = { scope: globalThis as Scope, records, replace };
  const pending = new Map<number, Pending>();
  const frames = new Map<number, Pending>();
  watchListeners(patch);
  watchTimer(patch, pending, 'timeout', 'setTimeout', 'clearTimeout');
  watchTimer(patch, pending, 'interval', 'setInterval', 'clearInterval');
  watchFrames(patch, frames);
  watchObservers(patch);
  watchMedia(patch);

  return {
    live() {
      for (const r of records) if (collected(r)) records.delete(r);
      return [...records].filter((r) => r.held());
    },
    flush(rounds = 20) {
      for (let i = 0; i < rounds; i++) {
        let ran = 0;
        act(() => {
          ran = runAll(pending) + runAll(frames);
        });
        if (ran === 0) return;
      }
    },
    restore() {
      for (const p of [...pending.values(), ...frames.values()]) p.clear();
      while (undo.length) undo.pop()!();
    },
  };
}

/** The difference in live registrations of each kind between `before` and `after`, as a line per kind that grew. */
export function grownSince(before: readonly Live[], after: readonly Live[]): string[] {
  const out: string[] = [];
  for (const kind of LEAK_KINDS) {
    const was = before.filter((r) => r.kind === kind).length;
    const now = after.filter((r) => r.kind === kind);
    if (now.length <= was) continue;
    const added = now.filter((r) => !before.includes(r));
    out.push(`${kind} ${was} → ${now.length}: ${added.map((r) => `${r.what}\n${r.stack()}`).join('\n')}`);
  }
  return out;
}
