import {
  KEY_MIN_SCALE, KEY_SPELLINGS, pickSpelling, resolveBankScales, spellingsOf,
  type KeySpellings, type LegendFit,
} from './legendFit';
import { cssPx } from '../../cssPx';

/** Vertical room kept clear inside the key, for the thicker bottom border. */
const ROOM_H_SLACK = 4;

/** The spelling a bank member prints, and the largest scale it fits at. */
export interface LegendPick {
  label: string;
  wrapped: boolean;
  scale: number;
}

const samePick = (a: LegendPick | null, b: LegendPick) =>
  !!a && a.label === b.label && a.wrapped === b.wrapped && Math.abs(a.scale - b.scale) < 0.001;

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** A 2D context for measuring text, or null where none can work: jsdom has no
 *  canvas, and asking it for one logs an error. */
function measureContext(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    const jsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
    measureCtx = jsdom || typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  return measureCtx;
}

interface Room {
  font: string;
  letterSpacing: string;
  size: number;
  lineHeight: number;
  width: number;
  height: number;
}

/** Everything a fit reads from the page, read in one go so a pass over many
 *  keys lays the page out once. */
function readRoom(kbd: HTMLElement): Room | null {
  const cs = getComputedStyle(kbd);
  const applied = cssPx(cs.getPropertyValue('--key-legend-scale')) || 1;
  const size = cssPx(cs.fontSize) / applied;
  if (!size) return null;
  return {
    font: `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`,
    letterSpacing: cs.letterSpacing,
    size,
    lineHeight: cssPx(cs.getPropertyValue('--key-wrap-line-height')) || 1,
    width: kbd.clientWidth - cssPx(cs.paddingLeft) - cssPx(cs.paddingRight),
    height: kbd.clientHeight - cssPx(cs.paddingTop) - cssPx(cs.paddingBottom) - ROOM_H_SLACK,
  };
}

function fitForms(ctx: CanvasRenderingContext2D, room: Room, forms: readonly string[]): LegendFit[] {
  ctx.font = room.font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = room.letterSpacing === 'normal' ? '0px' : room.letterSpacing;
  return forms.map((label) => {
    const lines = label.split('\n');
    const wide = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const tall = lines.length * room.size * (lines.length > 1 ? room.lineHeight : 1);
    return { label, lines: lines.length, scale: Math.min(room.width / wide, room.height / tall) };
  });
}

interface Member {
  el: HTMLElement;
  label: string;
  wrap: boolean;
  onFit: (pick: LegendPick) => void;
  pick: LegendPick | null;
  /** The box size last observed, so only a real change re-measures. */
  observed?: string;
}

/**
 * Fits a bank's keys in batches. Every key waiting on a measurement is read in
 * one pass and written after, so a pass lays the page out once however many
 * keys it covers. A key re-measures only when it joins or changes, when its
 * box is resized, or when a font finishes loading — never because the bank's
 * scale moved, since its room does not depend on that.
 */
export class BankFitter {
  private readonly members = new Map<string, Member>();
  private readonly ids = new WeakMap<Element, string>();
  private readonly dirty = new Set<string>();
  private queued = false;
  private resize: ResizeObserver | null = null;
  private spellings: KeySpellings = KEY_SPELLINGS;
  private scale: number | null = null;
  minScale = KEY_MIN_SCALE;

  constructor(private readonly onScale: (scale: number | null) => void) {}

  configure(spellings: KeySpellings, minScale: number): void {
    if (spellings === this.spellings && minScale === this.minScale) return;
    this.spellings = spellings;
    this.minScale = minScale;
    this.markAll();
  }

  attach(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resize = new ResizeObserver(this.resized);
      for (const m of this.members.values()) this.resize.observe(m.el);
    }
    document.fonts?.addEventListener?.('loadingdone', this.markAll);
  }

  detach(): void {
    this.resize?.disconnect();
    this.resize = null;
    document.fonts?.removeEventListener?.('loadingdone', this.markAll);
  }

  join(id: string, el: HTMLElement, label: string, wrap: boolean, onFit: (pick: LegendPick) => void): void {
    const prev = this.members.get(id);
    if (prev && prev.el !== el) this.resize?.unobserve(prev.el);
    if (!prev || prev.el !== el) this.resize?.observe(el);
    this.ids.set(el, id);
    this.members.set(id, { el, label, wrap, onFit, pick: null, observed: prev?.el === el ? prev.observed : undefined });
    this.dirty.add(id);
    this.queue();
  }

  leave(id: string): void {
    const m = this.members.get(id);
    if (!m) return;
    this.resize?.unobserve(m.el);
    this.members.delete(id);
    this.dirty.delete(id);
    this.resolve();
  }

  /** Measures every key waiting on one: all reads first, then all writes. */
  flush(): void {
    this.queued = false;
    if (!this.dirty.size) return;
    const ctx = measureContext();
    const waiting = [...this.dirty].map((id) => this.members.get(id)).filter((m): m is Member => !!m);
    this.dirty.clear();
    if (!ctx) return;
    const rooms = waiting.map((m) => readRoom(m.el));
    waiting.forEach((m, i) => {
      const room = rooms[i];
      if (!room) return;
      const best = pickSpelling(fitForms(ctx, room, spellingsOf(m.label, this.spellings)), { wrap: m.wrap, minScale: this.minScale });
      const pick = { label: best.label, wrapped: best.lines > 1, scale: best.scale };
      if (samePick(m.pick, pick)) return;
      m.pick = pick;
      m.onFit(pick);
    });
    this.resolve();
  }

  private resolve(): void {
    const fitted = [...this.members.values()].flatMap((m) => (m.pick ? [m.pick] : []));
    const single = fitted.findIndex((p) => !p.wrapped);
    const next = single < 0 ? null : Math.round(resolveBankScales(fitted, this.minScale)[single]! * 1000) / 1000;
    if (next === this.scale) return;
    this.scale = next;
    this.onScale(next);
  }

  private queue(): void {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => this.flush());
  }

  private readonly markAll = (): void => {
    for (const id of this.members.keys()) this.dirty.add(id);
    this.queue();
  };

  private readonly resized = (entries: ResizeObserverEntry[]): void => {
    for (const entry of entries) {
      const id = this.ids.get(entry.target);
      const m = id === undefined ? undefined : this.members.get(id);
      if (!m) continue;
      const size = `${entry.contentRect.width}x${entry.contentRect.height}`;
      // The first observation reports the size the key was measured at.
      if (m.observed !== undefined && m.observed !== size) this.dirty.add(id!);
      m.observed = size;
    }
    this.flush();
  };
}
