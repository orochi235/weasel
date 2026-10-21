import type { LensIds, LensSettings, LensSourceKind, LoupePoint } from './lensTypes';

/** `true`, or the reason the source cannot answer. It is the one availability
 *  shape, shared with the lens actions' `sourceAvailable`. */
export type LensSourceStatus = true | string;

/** What a lens asks its source to show, sent on attach and on every change. */
export interface LensSourceRequest<C> {
  lensId: string;
  /** In client px. */
  reticle: LoupePoint;
  factor: number;
  /** The interior, in CSS px. */
  size: { width: number; height: number };
  /** Null: the story as it is. */
  conditions: C | null;
  dpr: number;
}

/** A pixels source's capture of a lens's patch. */
export interface LensCapture {
  bitmap: ImageBitmap;
  dpr: number;
  box: { width: number; height: number };
  /** The reticle in host px. */
  at: LoupePoint;
}

/** A source attached to one lens cell: takes each new request, and lets go of the cell on `detach`. */
export interface LensSourceHandle<C> {
  update(request: LensSourceRequest<C>): void;
  detach(): void;
}

/** What renders a lens's patch: a Live render into the interior, or pixels captured elsewhere. */
export interface LensSource<C> {
  readonly kind: LensSourceKind;
  readonly produces: 'dom' | 'pixels';
  /** Shown on the lens chrome: "Live", "Pixels 2×". */
  label(request: LensSourceRequest<C>): string;
  status(): LensSourceStatus;
  subscribe(listener: () => void): () => void;
  attach(slot: HTMLElement, request: LensSourceRequest<C>): LensSourceHandle<C>;
  /** Required when `produces` is `'pixels'`. Answers why when it has no capture to give. */
  capture?(request: LensSourceRequest<C>): Promise<LensCapture | { reason: string }>;
}

/** The sources a host offers its lenses, by kind. */
export type LensSources<C> = Partial<Record<LensSourceKind, LensSource<C>>>;

/** What a lens's interior is drawn from: its ids, settings, the host's sources, where it aims and its size. */
export interface LensSlotProps<C> {
  lens: LensIds;
  settings: LensSettings<C>;
  sources: LensSources<C>;
  reticle: LoupePoint;
  size: { width: number; height: number };
  describe: (c: C, at: LensDescribeContext) => string;
}

/** What a lens's comparison is named against: the lens, where it aims, and the source it really shows. */
export interface LensDescribeContext {
  lensId: string;
  /** In client px. */
  reticle: LoupePoint;
  /** The kind of source the lens shows, after any fallback; Difference always shows Pixels. */
  source: LensSourceKind | null;
}

/** Every source kind, in the order a lens falls back through them. */
export const LENS_SOURCE_KINDS: readonly LensSourceKind[] = [
  'live',
  'pixels',
  'revision',
  'reference',
];

const KIND_LABEL: Record<LensSourceKind, string> = {
  live: 'Live',
  pixels: 'Pixels',
  revision: 'Revision',
  reference: 'Reference',
};

/** How a lens says a source cannot answer: "Pixels unavailable: install playwright". */
export const unavailableText = (kind: LensSourceKind, reason: string): string =>
  `${KIND_LABEL[kind]} unavailable: ${reason}`;

/** What a lens shows: the source it wanted when that answers, else the first
 *  that does. */
export interface LensResolution<C> {
  source: LensSource<C> | null;
  /** Why the wanted source was not used; null when it was. */
  reason: string | null;
}

/** The source `wanted` names when it answers, else the first that does, with why `wanted` did not. */
export function resolveSource<C>(
  wanted: LensSourceKind,
  sources: LensSources<C>,
): LensResolution<C> {
  const status = (kind: LensSourceKind): LensSourceStatus => {
    const source = sources[kind];
    return source ? source.status() : 'not provided';
  };
  const own = status(wanted);
  if (own === true) return { source: sources[wanted] ?? null, reason: null };
  const fallback = LENS_SOURCE_KINDS.find((k) => k !== wanted && status(k) === true);
  return {
    source: fallback ? (sources[fallback] ?? null) : null,
    reason: unavailableText(wanted, own),
  };
}

/** What a lens shows: the source its settings resolve to, except that Difference
 *  compares two Pixels captures whatever the lens's source, so it shows Pixels
 *  or why Pixels cannot answer. */
export function shownSource<C>(
  settings: LensSettings<C>,
  sources: LensSources<C>,
): LensResolution<C> {
  if (settings.compare === null || settings.view !== 'difference')
    return resolveSource(settings.source, sources);
  const pixels = sources.pixels;
  const status = pixels ? pixels.status() : 'not provided';
  if (status === true) return { source: pixels ?? null, reason: null };
  return { source: null, reason: unavailableText('pixels', status) };
}

/** One request per side-by-side cell: a pixels source gets one per DPR, any
 *  other source one. Each cell takes an equal share of the interior's width. */
export function requestsOf<C>(
  source: LensSource<C> | null,
  lens: LensIds,
  settings: LensSettings<C>,
  reticle: LoupePoint,
  size: { width: number; height: number },
): LensSourceRequest<C>[] {
  const dprs = source?.produces === 'pixels' && settings.dprs.length > 0 ? settings.dprs : null;
  const each = dprs ?? [settings.dprs[0] ?? 1];
  return each.map((dpr) => ({
    lensId: lens.lensId,
    reticle,
    factor: settings.factor,
    size: { width: size.width / each.length, height: size.height },
    conditions: settings.compare,
    dpr,
  }));
}
