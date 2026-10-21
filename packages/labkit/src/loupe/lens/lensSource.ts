import type { LensIds, LensSettings, LensSourceKind, LoupePoint } from './lensTypes';

/** `true`, or the reason the source cannot answer. It is the one availability
 *  shape, shared with the lens actions' `sourceAvailable`. */
export type LensSourceStatus = true | string;

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

export interface LensCapture {
  bitmap: ImageBitmap;
  dpr: number;
  box: { width: number; height: number };
  /** The reticle in host px. */
  at: LoupePoint;
}

export interface LensSourceHandle<C> {
  update(request: LensSourceRequest<C>): void;
  detach(): void;
}

export interface LensSource<C> {
  readonly kind: LensSourceKind;
  readonly produces: 'dom' | 'pixels';
  /** Shown on the lens chrome: "Live", "Pixels 2×". */
  label(request: LensSourceRequest<C>): string;
  status(): LensSourceStatus;
  subscribe(listener: () => void): () => void;
  attach(slot: HTMLElement, request: LensSourceRequest<C>): LensSourceHandle<C>;
  /** Required when `produces` is `'pixels'`. */
  capture?(request: LensSourceRequest<C>): Promise<LensCapture | null>;
}

export type LensSources<C> = Partial<Record<LensSourceKind, LensSource<C>>>;

export interface LensSlotProps<C> {
  lens: LensIds;
  settings: LensSettings<C>;
  sources: LensSources<C>;
  reticle: LoupePoint;
  size: { width: number; height: number };
  describe: (c: C) => string;
}

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
