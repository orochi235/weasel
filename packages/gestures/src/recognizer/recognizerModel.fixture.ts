/**
 * A model of the pointer recognizer for its stateful property test: what it holds, and the events each sample
 * should dispatch. Test-only.
 */
import type { EventModifiers, InputEvent } from '../ui/inputEvent';
import { DRAG_THRESHOLD_PX } from '../ui/dragThreshold';
import { multiTouchGeometry, type Point } from './multiTouch';
import { DOUBLE_CLICK_MAX_MS, DOUBLE_CLICK_MAX_PX, LONG_PRESS_MS, TAP_THRESHOLD_PX } from './thresholds';

/** A run's thresholds (absent, the defaults) and how its sink answers. */
export interface Config {
  dragPx?: number;
  longPressMs?: number;
  doubleClickMs?: number;
  doubleClickPx?: number;
  tapPx?: number;
  /** Event kinds the sink answers `'handled'` to. */
  handles: readonly string[];
  /** Finger counts the sink reports a multitouch gesture in flight for. */
  inFlight: readonly number[];
  /** Whether samples carry a `timeStamp`. */
  stamped: boolean;
}

/** The world point a client point maps to in every run. */
export const toWorld = (x: number, y: number): Point => ({ x: x + 1000, y: y - 1000 });

interface Pointer {
  touch: boolean;
  holdType?: 'touch' | 'pen';
  press: { clientX: number; clientY: number } & EventModifiers;
  pos: Point;
  buffered: boolean;
}

interface Episode { fingers: number; joinedAt: Map<number, Point>; moved: boolean; startedAt: number }

export interface Model {
  cfg: Config;
  t: number;
  /** The latest time a sample was read as happening at, so stamps never run backward. */
  happened: number;
  held: Map<number, Pointer>;
  last: { t: number; clientX: number; clientY: number } | null;
  hold: { id: number; at: number } | null;
  episode: Episode | null;
}

/** An event as far as the model predicts it. */
export type Expected = Partial<InputEvent> & { kind: InputEvent['kind'] } & Record<string, unknown>;

export function freshModel(cfg: Config): Model {
  return { cfg, t: 0, happened: 0, held: new Map(), last: null, hold: null, episode: null };
}

const limits = (m: Model) => ({
  dragPx: m.cfg.dragPx ?? DRAG_THRESHOLD_PX,
  longPressMs: m.cfg.longPressMs ?? LONG_PRESS_MS,
  maxMs: m.cfg.doubleClickMs ?? DOUBLE_CLICK_MAX_MS,
  maxPx: m.cfg.doubleClickPx ?? DOUBLE_CLICK_MAX_PX,
  tapPx: m.cfg.tapPx ?? TAP_THRESHOLD_PX,
});

const modsOf = (e: EventModifiers): EventModifiers => (
  { altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey }
);

/** A sample's stamp `back` ms behind the clock, never before the last input. Absent when the run is unstamped. */
export function stampFor(m: Model, back: number): number | undefined {
  if (!m.cfg.stamped) return undefined;
  return Math.max(m.happened, m.t - back);
}

/** When the recognizer reads a sample stamped `stamp` as having happened. */
function happenedAt(m: Model, stamp: number | undefined): number {
  const at = stamp !== undefined && stamp > 0 && stamp <= m.t ? stamp : m.t;
  m.happened = Math.max(m.happened, at);
  return at;
}

const fingers = (m: Model): [number, Pointer][] => [...m.held].filter(([, p]) => p.touch);

function geometry(m: Model) {
  return multiTouchGeometry(fingers(m).map(([, p]) => p.pos));
}

function cancelHold(m: Model, id: number): void {
  if (m.hold?.id === id) m.hold = null;
}

export interface SampleIn extends EventModifiers { id: number; x: number; y: number; stamp: number | undefined }

export function press(m: Model, s: SampleIn, pointerType: 'mouse' | 'touch' | 'pen'): Expected[] {
  const out: Expected[] = cancel(m, s.id);
  const touch = pointerType === 'touch';
  m.held.set(s.id, { touch, press: { clientX: s.x, clientY: s.y, ...modsOf(s) }, pos: { x: s.x, y: s.y }, buffered: true });
  const hand = touch ? fingers(m).length : 0;
  if (hand < 2) out.push({ kind: 'pointerdown', stage: 'press', pointerId: s.id, clientX: s.x, clientY: s.y, ...modsOf(s) });
  if (pointerType !== 'mouse' && m.held.size === 1) {
    m.held.get(s.id)!.holdType = pointerType;
    m.hold = { id: s.id, at: m.t + limits(m).longPressMs };
  }
  if (hand >= 2) {
    for (const [id, p] of fingers(m)) {
      cancelHold(m, id);
      p.buffered = false;
    }
    m.last = null;
    const now = happenedAt(m, s.stamp);
    m.episode ??= { fingers: 0, joinedAt: new Map(), moved: false, startedAt: now };
    m.episode.fingers = Math.max(m.episode.fingers, hand);
    for (const [id, p] of fingers(m)) if (!m.episode.joinedAt.has(id)) m.episode.joinedAt.set(id, { ...p.pos });
    out.push({ kind: 'multitouch', fingers: hand, ...geometry(m), ...modsOf(s) });
  }
  return out;
}

function episodeMoved(m: Model, id: number, to: Point): void {
  const from = m.episode?.joinedAt.get(id);
  if (m.episode && from && Math.hypot(to.x - from.x, to.y - from.y) > limits(m).tapPx) m.episode.moved = true;
}

const at = (s: SampleIn) => {
  const w = toWorld(s.x, s.y);
  return { pointerId: s.id, clientX: s.x, clientY: s.y, x: w.x, y: w.y, ...modsOf(s) };
};

export function move(m: Model, s: SampleIn): Expected[] {
  const out: Expected[] = [];
  const p = m.held.get(s.id);
  const to = { x: s.x, y: s.y };
  if (p) p.pos = to;
  if (p?.touch) episodeMoved(m, s.id, to);
  if (p?.buffered && Math.hypot(s.x - p.press.clientX, s.y - p.press.clientY) >= limits(m).dragPx) {
    p.buffered = false;
    m.last = null;
    cancelHold(m, s.id);
    out.push({ kind: 'pointerdown', pointerId: s.id, clientX: p.press.clientX, clientY: p.press.clientY, ...modsOf(p.press) });
  }
  const hand = p?.touch ? fingers(m).length : 0;
  if (hand >= 2 && m.cfg.inFlight.includes(hand)) out.push({ kind: 'multitouch', fingers: hand, ...geometry(m), ...modsOf(s) });
  out.push({ kind: 'pointermove', ...at(s) });
  return out;
}

export function release(m: Model, s: SampleIn): { events: Expected[]; doubleClick?: 'handled' | 'unhandled' } {
  const out: Expected[] = [];
  const p = m.held.get(s.id);
  if (p) {
    const before = p.touch ? fingers(m).length : 0;
    cancelHold(m, s.id);
    m.held.delete(s.id);
    if (p.touch) {
      if (before >= 2) out.push({ kind: 'multitouch', fingers: before, end: 'commit', ...modsOf(s) });
      episodeMoved(m, s.id, { x: s.x, y: s.y });
      if (before === 2) {
        const e = m.episode;
        m.episode = null;
        const brief = e && happenedAt(m, s.stamp) - e.startedAt < limits(m).longPressMs;
        if (e && brief && !e.moved) out.push({ kind: 'multitouchtap', fingers: e.fingers, ...modsOf(s) });
      }
    }
  }
  out.push({ kind: 'pointerup', ...at(s) });
  if (!p?.buffered) return { events: out };
  const w = toWorld(s.x, s.y);
  const pressWorld = toWorld(p.press.clientX, p.press.clientY);
  out.push({ kind: 'click', clientX: s.x, clientY: s.y, x: w.x, y: w.y, pressX: pressWorld.x, pressY: pressWorld.y, ...modsOf(s) });
  const t = happenedAt(m, s.stamp);
  const { maxMs, maxPx } = limits(m);
  const prev = m.last;
  if (!(prev && t - prev.t < maxMs && Math.hypot(s.x - prev.clientX, s.y - prev.clientY) < maxPx)) {
    m.last = { t, clientX: s.x, clientY: s.y };
    return { events: out };
  }
  m.last = null;
  out.push({ kind: 'doubleclick', clientX: s.x, clientY: s.y, ...modsOf(s) });
  return { events: out, doubleClick: m.cfg.handles.includes('doubleclick') ? 'handled' : 'unhandled' };
}

export function cancel(m: Model, id: number): Expected[] {
  const p = m.held.get(id);
  if (!p) return [];
  const out: Expected[] = [];
  const before = p.touch ? fingers(m).length : 0;
  m.held.delete(id);
  cancelHold(m, id);
  m.last = null;
  if (before >= 2) out.push({ kind: 'multitouch', fingers: before, end: 'cancel', ...modsOf(p.press) });
  if (p.touch) m.episode = null;
  out.push({ kind: 'pointercancel', pointerId: id, ...modsOf(p.press) });
  return out;
}

function fire(m: Model, id: number): Expected[] {
  const p = m.held.get(id);
  if (!p) return [];
  const where = { clientX: p.press.clientX, clientY: p.press.clientY, ...toWorld(p.press.clientX, p.press.clientY), ...modsOf(p.press) };
  const out: Expected[] = [{ kind: 'longpress', ...where }];
  let handled = m.cfg.handles.includes('longpress');
  if (!handled) {
    out.push({ kind: 'contextmenu', ...where });
    handled = m.cfg.handles.includes('contextmenu');
  }
  if (handled) {
    p.buffered = false;
    m.last = null;
  }
  return out;
}

export function advance(m: Model, ms: number): Expected[] {
  m.t += ms;
  const due = m.hold && m.hold.at <= m.t ? m.hold : null;
  if (!due) return [];
  m.hold = null;
  return fire(m, due.id);
}

export function takeHold(m: Model): { events: Expected[]; holding: boolean } {
  const out: Expected[] = [];
  let holding = false;
  for (const [id, p] of m.held) {
    if (!p.holdType) continue;
    holding = true;
    if (m.hold?.id !== id) continue;
    m.hold = null;
    out.push(...fire(m, id));
  }
  return { events: out, holding };
}

export function reset(m: Model): void {
  m.hold = null;
  m.held.clear();
  m.episode = null;
}
