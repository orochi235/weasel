import { useLayoutEffect, useState, type RefObject } from 'react';

/** What a member of a {@link FitScale} measured: the largest scale its form fits its room at, and whether it prints
 *  at the scope's shared scale or at its own. */
export interface ScaleFit {
  readonly scale: number;
  readonly shared: boolean;
}

/** One element fitted by a {@link FitScale}. */
export interface ScaleMember<T extends ScaleFit> {
  readonly el: HTMLElement;
  /** Reads the member's room and fits a form to it, or returns null where nothing can be measured. Runs beside
   *  every other waiting member's, before any of them hears its fit, so a pass lays the page out once. */
  readonly measure: () => T | null;
  /** Hears a fit that differs from the member's last. */
  readonly onFit: (fit: T) => void;
  /** Whether two fits print the same. Defaults to equal scales and sharing. */
  readonly same?: (a: T, b: T) => boolean;
}

/** A `FitScope`'s scale stage: its members' forms are fitted by measurement, and every shared one prints at
 *  the smallest scale any of them needs, floored at `min`. */
export interface FitScale {
  /** How far the shared scale may shrink. */
  readonly min: number;
  /** Adds or replaces the member under `id` and measures it. */
  join<T extends ScaleFit>(id: string, member: ScaleMember<T>): void;
  leave(id: string): void;
}

/** How a `useFitScope` scope scales its members. */
export interface FitScaleOptions {
  /** How far the shared scale may shrink. */
  readonly min: number;
  /** The custom property the shared scale is published on, on the scope's element, for its members' CSS to read.
   *  Absent until a shared member has measured. */
  readonly property: string;
}

interface Entry {
  el: HTMLElement;
  measure: () => ScaleFit | null;
  hear: (fit: ScaleFit) => void;
  /** Makes the next fit heard even if it prints the same as the last. */
  forget: () => void;
  fit: ScaleFit | null;
  /** The box size last observed, so only a real change re-measures. */
  observed?: string;
}

/** The scale every shared fit prints at: the smallest any of them needs, never past 1 and never below `min`; null
 *  when none is shared. */
export function sharedScale(fits: Iterable<ScaleFit | null>, min: number): number | null {
  let least: number | null = null;
  for (const fit of fits) {
    if (fit?.shared) least = Math.min(least ?? 1, fit.scale);
  }
  return least === null ? null : Math.max(min, Math.min(1, least));
}

const sameFit = (a: ScaleFit, b: ScaleFit) => a.shared === b.shared && Math.abs(a.scale - b.scale) < 0.001;

/**
 * Fits a scope's members in batches. Every member waiting on a measurement is read in one pass and told after, so
 * a pass lays the page out once however many members it covers. A member re-measures only when it joins, when its
 * box is resized, when `min` changes, or when a font finishes loading — never because the shared scale moved.
 */
export class ScaleStage implements FitScale {
  private readonly members = new Map<string, Entry>();
  private readonly ids = new WeakMap<Element, string>();
  private readonly dirty = new Set<string>();
  private queued = false;
  private resize: ResizeObserver | null = null;
  private scale: number | null = null;
  min: number;

  constructor(
    private readonly scope: RefObject<HTMLElement | null>,
    private property: string,
    min: number,
  ) {
    this.min = min;
  }

  configure(min: number, property: string): void {
    if (property !== this.property) {
      this.scope.current?.style.removeProperty(this.property);
      this.property = property;
      this.write();
    }
    if (min === this.min) return;
    this.min = min;
    // A member that sizes itself clamps its own scale to `min`, so it hears its fit again.
    for (const m of this.members.values()) m.forget();
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

  join<T extends ScaleFit>(id: string, { el, measure, onFit, same = sameFit }: ScaleMember<T>): void {
    const prev = this.members.get(id);
    if (prev && prev.el !== el) this.resize?.unobserve(prev.el);
    if (!prev || prev.el !== el) this.resize?.observe(el);
    this.ids.set(el, id);
    let last: T | null = null;
    const entry: Entry = {
      el,
      measure,
      fit: null,
      observed: prev?.el === el ? prev.observed : undefined,
      hear: (fit) => {
        const next = fit as T;
        entry.fit = next;
        if (last && same(last, next)) return;
        last = next;
        onFit(next);
      },
      forget: () => {
        last = null;
      },
    };
    this.members.set(id, entry);
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

  /** Measures every member waiting on one: all reads first, then all fits heard. */
  flush(): void {
    this.queued = false;
    if (!this.dirty.size) return;
    const waiting = [...this.dirty].map((id) => this.members.get(id)).filter((m): m is Entry => !!m);
    this.dirty.clear();
    const fits = waiting.map((m) => m.measure());
    waiting.forEach((m, i) => {
      const fit = fits[i];
      if (fit) m.hear(fit);
    });
    this.resolve();
  }

  private resolve(): void {
    const shared = sharedScale([...this.members.values()].map((m) => m.fit), this.min);
    const next = shared === null ? null : Math.round(shared * 1000) / 1000;
    if (next === this.scale) return;
    this.scale = next;
    this.write();
  }

  private write(): void {
    const el = this.scope.current;
    if (!el) return;
    if (this.scale === null) el.style.removeProperty(this.property);
    else el.style.setProperty(this.property, String(this.scale));
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
      // The first observation reports the size the member was measured at.
      if (m.observed !== undefined && m.observed !== size) this.dirty.add(id!);
      m.observed = size;
    }
    this.flush();
  };
}

/** The scale stage a `useFitScope` scope runs when mounted with `options`, or null. */
export function useScaleStage(ref: RefObject<HTMLElement | null>, options: FitScaleOptions | undefined): ScaleStage | null {
  const min = options?.min;
  const property = options?.property;
  const [stage] = useState(() => (options ? new ScaleStage(ref, options.property, options.min) : null));
  useLayoutEffect(() => {
    stage?.attach();
    return () => stage?.detach();
  }, [stage]);
  useLayoutEffect(() => {
    if (stage && min !== undefined && property !== undefined) stage.configure(min, property);
  }, [stage, min, property]);
  // Members join in their own layout effects, which run before this one, so a commit's members are all measured
  // here in one pass, before paint.
  useLayoutEffect(() => stage?.flush());
  return stage;
}
