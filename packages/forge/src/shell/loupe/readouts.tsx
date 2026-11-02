import { contrastRatio, luminanceContrast, parseColor, relativeLuminance, useLatest, wcagLevels } from '@weasel-js/core';
import {
  type LensCapture,
  type LensReadoutProps,
  type LensSlotProps,
  type LoupePoint,
  readBitmap,
  requestsOf,
  useShownSource,
} from '@weasel-js/labkit/loupe';
import { Fragment, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { revealVar } from '../cssVars/reveal';
import type { ForgeComparison } from './conditions';
import { backgroundOf, colorAt, tokenChain } from './tokenChain';
import { trialAt } from './trialAt';
import { varRefs } from '../../frame/cssVarUse';

export const NO_TEXT = 'No text under the aim';
export const NO_BACKGROUND = 'No opaque background behind the text';
export const unreadable = (color: string) => `Cannot read the color "${color}"`;
export const NO_CAPTURE = 'No capture to read';
export const OUTSIDE = 'The aim is outside the capture';
export const NO_COLOR = 'No color under the aim';
export const NEEDS_LIVE = 'Token needs a Live source for changed conditions';
export const IN_FRAME = "Cannot read inside an isolated story's frame";

export type ContrastReading =
  | { ratio: number; aa: boolean; aaa: boolean; large: boolean }
  | { unavailable: string };

/** Pixels either side of the aim that a Pixels reading looks at: a 5×5 neighborhood. */
const REACH = 2;

/** WCAG's large text: 24px and up, or 18.66px and up when bold. */
function isLarge(style: CSSStyleDeclaration): boolean {
  const px = Number.parseFloat(style.fontSize);
  const w = style.fontWeight === 'bold' ? 700 : Number.parseInt(style.fontWeight, 10);
  return px >= 24 || (px >= 18.66 && w >= 700);
}

const luminanceAt = (d: Uint8ClampedArray, i: number) =>
  relativeLuminance((d[i] as number) / 255, (d[i + 1] as number) / 255, (d[i + 2] as number) / 255);

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
  const ratio = luminanceContrast(luminanceAt(data, center), luminanceAt(data, far));
  return { ratio, ...wcagLevels(ratio, false), large: false };
}

/**
 * The contrast of what lies under a lens's aim. Over a Live source it is the
 * text drawn at `point` inside `within` against the first opaque background
 * from it up to `within`, found by the same hit test as the Token readout's;
 * over Pixels it is the pixel at `point`, in host px, against the most
 * distant color within two pixels of it in `capture`.
 */
export function contrastAt(
  source: 'live' | 'pixels',
  at: { within?: HTMLElement; capture?: LensCapture; point: LoupePoint },
): ContrastReading {
  if (source === 'pixels') return ofPixels(at.capture, at.point);
  const text = at.within ? colorAt(at.point, at.within) : null;
  if (!text || text.property !== 'color') return { unavailable: NO_TEXT };
  const style = getComputedStyle(text.element);
  const background = backgroundOf(text.element, at.within);
  if (background === null) return { unavailable: NO_BACKGROUND };
  if ('unreadable' in background) return { unavailable: unreadable(background.unreadable) };
  const ratio = contrastRatio(style.color, background.color);
  if (ratio === null) return { unavailable: unreadable(style.color) };
  const large = isLarge(style);
  return { ratio, ...wcagLevels(ratio, large), large };
}

/** A lens's own compared copy. A Split lens holds the compared render beside the base one, so the `~compared` copy is preferred. */
function copyIn(interior: HTMLElement | null): HTMLElement | undefined {
  const copies = Array.from(interior?.querySelectorAll<HTMLElement>('[data-fg-copy]') ?? []);
  return copies.find((c) => (c.getAttribute('data-fg-host') ?? '').endsWith('~compared')) ?? copies[0];
}

/** Where a lens's compared render sits at its aim, in client px: the interior's center, in Swap and Split alike, since each side renders the whole interior. */
function comparedAim(interior: HTMLElement | null): LoupePoint | null {
  const box = interior?.getBoundingClientRect();
  return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
}

/** A Live reading's subject: an element to read inside and the client point to read at, or why there is none. */
type LiveAim = { within?: HTMLElement; point: LoupePoint } | { unavailable: string };

/**
 * What a Live lens reads, and where in it: its compared copy at its aim when it has a comparison, else the main story
 * at the reticle. An isolated story renders in a frame of its own, whose document a readout cannot reach.
 */
function liveAim(
  interior: HTMLElement | null,
  settings: LensSlotProps<ForgeComparison>['settings'],
  reticle: LoupePoint,
): LiveAim {
  const aim =
    settings.compare === null
      ? { within: trialAt(reticle)?.host, point: reticle }
      : { within: copyIn(interior), point: comparedAim(interior) ?? reticle };
  return aim.within?.classList.contains('fg-frame-host') ? { unavailable: IN_FRAME } : aim;
}

const verdict = (pass: boolean) => (pass ? 'pass' : 'fail');

function textOf(reading: ContrastReading): string {
  if ('unavailable' in reading) return reading.unavailable;
  const base = `${reading.ratio.toFixed(2)}:1 · AA ${verdict(reading.aa)} · AAA ${verdict(reading.aaa)}`;
  return reading.large ? `${base} · large text` : base;
}

/** The Contrast readout: the WCAG ratio of what lies under the aim, and whether it passes AA and AAA. */
export function ContrastReadout({ lens, settings, sources, reticle, size, interior }: LensReadoutProps<ForgeComparison>) {
  const { source } = useShownSource(settings, sources);
  const kind = source?.kind;
  const subscribe = useCallback((fn: () => void) => source?.subscribe(fn) ?? (() => {}), [source]);
  // A Live reading is of the page as it stands, read each render and again whenever the source says a story changed.
  const live = useSyncExternalStore(subscribe, () => {
    if (kind !== 'live') return null;
    const aim = liveAim(interior, settings, reticle);
    return textOf('unavailable' in aim ? aim : contrastAt('live', aim));
  });
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

/** A Token reading: the color's property, each custom property it passes through, and the value they end at. */
export type TokenReading = { steps: readonly string[] } | { unavailable: string };

/**
 * How the color under a lens's aim is declared, read from the DOM: the lens's compared copy, or the main story when
 * nothing is compared. A Pixels capture of changed conditions has no DOM to read.
 */
export function tokenAt(
  kind: 'live' | 'pixels',
  interior: HTMLElement | null,
  settings: LensSlotProps<ForgeComparison>['settings'],
  reticle: LoupePoint,
): TokenReading {
  if (kind === 'pixels' && settings.compare !== null) return { unavailable: NEEDS_LIVE };
  const aim = liveAim(interior, settings, reticle);
  if ('unavailable' in aim) return aim;
  const { within, point } = aim;
  const at = within ? colorAt(point, within) : null;
  if (!at) return { unavailable: NO_COLOR };
  try {
    parseColor(at.value);
  } catch {
    return { unavailable: unreadable(at.value) };
  }
  const chain = tokenChain(at);
  // A value naming several tokens branches, and its last branch's literal is not the color: end on what it computes to.
  const branches = chain.some((l) => varRefs(l.declared).size > 1);
  const end = branches ? at.value : (chain.at(-1)?.declared ?? at.value);
  return { steps: [at.property, ...chain.slice(1).map((l) => l.property), end] };
}

const isToken = (step: string) => step.startsWith('--wzl-');

/** The Token readout: the chain of tokens the color under the aim comes from, each token opening the CSS vars panel at it. */
export function TokenReadout({ settings, sources, reticle, interior }: LensReadoutProps<ForgeComparison>) {
  const { source } = useShownSource(settings, sources);
  const kind = source?.kind;
  const subscribe = useCallback((fn: () => void) => source?.subscribe(fn) ?? (() => {}), [source]);
  const json = useSyncExternalStore(subscribe, () =>
    kind === 'live' || kind === 'pixels' ? JSON.stringify(tokenAt(kind, interior, settings, reticle)) : null,
  );
  const reading = useMemo(() => (json === null ? null : (JSON.parse(json) as TokenReading)), [json]);
  if (!reading) return null;
  if ('unavailable' in reading) return <span className="fg-lens-token">{reading.unavailable}</span>;
  return (
    <span className="fg-lens-token">
      {reading.steps.map((step, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ← ' : null}
          {isToken(step) && i < reading.steps.length - 1 ? (
            <button type="button" className="fg-lens-token__link" onClick={() => revealVar(step)}>
              {step}
            </button>
          ) : (
            step
          )}
        </Fragment>
      ))}
    </span>
  );
}

/** What a lens draws for the readouts it has on, other than the Pixel grid, which the lens draws itself. */
export function renderReadouts(props: LensReadoutProps<ForgeComparison>) {
  const { readouts } = props.settings;
  return (
    <>
      {readouts.includes('token') ? <TokenReadout {...props} /> : null}
      {readouts.includes('contrast') ? <ContrastReadout {...props} /> : null}
    </>
  );
}
