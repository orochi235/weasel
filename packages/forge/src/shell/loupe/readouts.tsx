import { contrastRatio, parseColor, useLatest, wcagLevels } from '@weasel-js/core';
import {
  type LensCapture,
  type LensSlotProps,
  type LoupePoint,
  readBitmap,
  requestsOf,
  useShownSource,
} from '@weasel-js/labkit/loupe';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ForgeComparison } from './conditions';

export const NO_TEXT = 'No text under the aim';
export const NO_BACKGROUND = 'No opaque background behind the text';
export const unreadable = (color: string) => `Cannot read the color "${color}"`;
export const NO_CAPTURE = 'No capture to read';
export const OUTSIDE = 'The aim is outside the capture';

export type ContrastReading =
  | { ratio: number; aa: boolean; aaa: boolean; large: boolean }
  | { unavailable: string };

/** Pixels either side of the aim that a Pixels reading looks at: a 5×5 neighborhood. */
const REACH = 2;

/** The first opaque `background-color` from `el` up; null when none is, or the unreadable color that stopped the walk. */
function backgroundOf(el: Element): { color: string } | { unreadable: string } | null {
  for (let at: Element | null = el; at; at = at.parentElement) {
    const color = getComputedStyle(at).backgroundColor;
    if (color.trim() === '') continue;
    try {
      if (parseColor(color)[3] === 1) return { color };
    } catch {
      return { unreadable: color };
    }
  }
  return null;
}

const hasText = (el: Element): boolean =>
  Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');

/** WCAG's large text: 24px and up, or 18.66px and up when bold. */
function isLarge(style: CSSStyleDeclaration): boolean {
  const px = Number.parseFloat(style.fontSize);
  const w = style.fontWeight === 'bold' ? 700 : Number.parseInt(style.fontWeight, 10);
  return px >= 24 || (px >= 18.66 && w >= 700);
}

const rgb = (d: Uint8ClampedArray, i: number) => `rgb(${d[i]}, ${d[i + 1]}, ${d[i + 2]})`;

function ofPixels(capture: LensCapture | undefined, point: LoupePoint): ContrastReading {
  const img = capture ? readBitmap(capture.bitmap) : null;
  if (!capture || !img) return { unavailable: NO_CAPTURE };
  const px = Math.floor(point.x * capture.dpr);
  const py = Math.floor(point.y * capture.dpr);
  if (px < 0 || py < 0 || px >= img.width || py >= img.height) return { unavailable: OUTSIDE };
  const { data, width, height } = img;
  const center = (py * width + px) * 4;
  let far = center;
  let best = 0;
  for (let y = Math.max(0, py - REACH); y <= Math.min(height - 1, py + REACH); y += 1) {
    for (let x = Math.max(0, px - REACH); x <= Math.min(width - 1, px + REACH); x += 1) {
      const i = (y * width + x) * 4;
      const d = [0, 1, 2].reduce((sum, c) => sum + ((data[i + c] as number) - (data[center + c] as number)) ** 2, 0);
      if (d > best) {
        best = d;
        far = i;
      }
    }
  }
  const ratio = contrastRatio(rgb(data, center), rgb(data, far));
  return ratio === null ? { unavailable: NO_CAPTURE } : { ratio, ...wcagLevels(ratio, false), large: false };
}

/**
 * The contrast of what lies under a lens's aim. Over a Live source it is the
 * text of `element` against the first opaque background up its ancestors;
 * over Pixels it is the pixel at `point`, in host px, against the most
 * distant color within two pixels of it in `capture`.
 */
export function contrastAt(
  source: 'live' | 'pixels',
  at: { element?: Element; capture?: LensCapture; point: LoupePoint },
): ContrastReading {
  if (source === 'pixels') return ofPixels(at.capture, at.point);
  const el = at.element;
  if (!el || !hasText(el)) return { unavailable: NO_TEXT };
  const style = getComputedStyle(el);
  const background = backgroundOf(el);
  if (background === null) return { unavailable: NO_BACKGROUND };
  if ('unreadable' in background) return { unavailable: unreadable(background.unreadable) };
  const ratio = contrastRatio(style.color, background.color);
  if (ratio === null) return { unavailable: unreadable(style.color) };
  const large = isLarge(style);
  return { ratio, ...wcagLevels(ratio, large), large };
}

/** The topmost element of a story, not of a lens's copy of one, under a client point. */
function elementAt(client: LoupePoint): Element | undefined {
  for (const el of document.elementsFromPoint?.(client.x, client.y) ?? []) {
    const host = el.closest('[data-fg-host]');
    if (host && !host.hasAttribute('data-fg-copy')) return el;
  }
  return undefined;
}

const interiorOf = (lensId: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('.lk-lens-interior')).find((el) => el.dataset.lens === lensId);

/**
 * The topmost element under a client point inside a lens's own compared copy, or undefined. A Split lens holds
 * the compared render beside the base one, so the `~compared` copy is preferred.
 */
function elementInCopy(lensId: string, client: LoupePoint): Element | undefined {
  const copies = Array.from(interiorOf(lensId)?.querySelectorAll('[data-fg-copy]') ?? []);
  const copy = copies.find((c) => (c.getAttribute('data-fg-host') ?? '').endsWith('~compared')) ?? copies[0];
  if (!copy) return undefined;
  return (document.elementsFromPoint?.(client.x, client.y) ?? []).find((el) => copy.contains(el));
}

/** Where a lens's compared render sits at its aim, in client px: the interior's center, in Swap and Split alike, since each side renders the whole interior. */
function comparedAim(lensId: string): LoupePoint | null {
  const box = interiorOf(lensId)?.getBoundingClientRect();
  return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
}

/** What a Live lens reads: its compared copy at its aim when it has a comparison, else the main story at the reticle. */
function liveAim(lensId: string, settings: LensSlotProps<ForgeComparison>['settings'], reticle: LoupePoint) {
  if (settings.compare === null) return { element: elementAt(reticle), point: reticle };
  const point = comparedAim(lensId) ?? reticle;
  return { element: elementInCopy(lensId, point), point };
}

const verdict = (pass: boolean) => (pass ? 'pass' : 'fail');

function textOf(reading: ContrastReading): string {
  if ('unavailable' in reading) return reading.unavailable;
  const base = `${reading.ratio.toFixed(2)}:1 · AA ${verdict(reading.aa)} · AAA ${verdict(reading.aaa)}`;
  return reading.large ? `${base} · large text` : base;
}

/** The Contrast readout: the WCAG ratio of what lies under the aim, and whether it passes AA and AAA. */
export function ContrastReadout({ lens, settings, sources, reticle, size }: LensSlotProps<ForgeComparison>) {
  const { source } = useShownSource(settings, sources);
  const kind = source?.kind;
  const subscribe = useCallback((fn: () => void) => source?.subscribe(fn) ?? (() => {}), [source]);
  // A Live reading is of the page as it stands, read each render and again whenever the source says a story changed.
  const live = useSyncExternalStore(subscribe, () =>
    kind === 'live' ? textOf(contrastAt('live', liveAim(lens.lensId, settings, reticle))) : null,
  );
  const [pixels, setPixels] = useState<ContrastReading | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => source?.subscribe(() => setTick((n) => n + 1)), [source]);
  const latest = useLatest({ lens, settings, reticle, size });
  useEffect(() => {
    if (kind !== 'pixels' || !source?.capture) return;
    const capture = source.capture.bind(source);
    let current = true;
    const timer = setTimeout(() => {
      const { lens: ids, settings: s, reticle: r, size: box } = latest.current;
      const [request] = requestsOf(source, ids, s, r, box);
      if (!request) return;
      void capture(request).then((got) => {
        if (current) setPixels('reason' in got ? { unavailable: got.reason } : contrastAt('pixels', { capture: got, point: got.at }));
      });
    }, 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [source, kind, reticle.x, reticle.y, settings.factor, settings.compare, tick, latest]);
  const text = kind === 'live' ? live : kind === 'pixels' && pixels ? textOf(pixels) : null;
  return text ? <span className="fg-lens-contrast">{text}</span> : null;
}

/** What a lens draws for the readouts it has on, other than the Pixel grid, which the lens draws itself. */
export function renderReadouts(props: LensSlotProps<ForgeComparison>) {
  return props.settings.readouts.includes('contrast') ? <ContrastReadout {...props} /> : null;
}
