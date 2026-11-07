import { createTarget, stateOf, type Target, type TargetAxes, type TargetState } from './target';

/** CSS for one value, by property as `Element.animate` takes a keyframe's: camelCase
 *  (`transform`, `opacity`), or a custom property (`--x`). */
export type ElementStyle = Readonly<Record<string, string | number>>;

/** An element whose inline style a target writes and whose `animate` it may hand a run to. */
export type StyledElement = Element & ElementCSSInlineStyle;

/** What {@link createElementTarget} takes. */
export interface ElementTargetOptions<T> {
  /** The element the value is shown on. */
  element: StyledElement;
  /** The CSS a value shows as. A run whose CSS names only `transform`, `translate`, `rotate`,
   *  `scale`, and `opacity` can run on the browser's compositor. */
  style(value: T): ElementStyle;
  /** The value it starts at, which the target then holds. Give `get` and `set` instead to keep
   *  the value yourself. */
  value?: T;
  /** The committed value, where the caller keeps it. */
  get?(): T;
  /** Commits a value, where the caller keeps it. */
  set?(value: T): void;
  /** How `T` maps to numbers, as `createTarget` takes it. */
  axes?: TargetAxes<T>;
  /** Keyframes a second a run handed to the compositor is sampled into. Default 60. */
  sampleRate?: number;
}

/** The properties a browser animates off its main thread. */
export const COMPOSITOR_PROPERTIES: ReadonlySet<string> = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity']);

/** What the animator knows of an element target beyond its value. */
export interface ElementBinding {
  readonly element: StyledElement;
  readonly style: (value: unknown) => ElementStyle;
  readonly sampleRate: number;
  /** Writes a value's CSS inline. */
  write(value: unknown): void;
}

const bindings = new WeakMap<TargetState, ElementBinding>();

/** The element behind `s`, where {@link createElementTarget} made it. */
export const bindingOf = (s: TargetState): ElementBinding | undefined => bindings.get(s);

function writeStyle(el: StyledElement, css: ElementStyle): void {
  for (const key in css) {
    const v = String(css[key]);
    if (key.startsWith('--')) el.style.setProperty(key, v);
    else (el.style as unknown as Record<string, string>)[key] = v;
  }
}

/**
 * A {@link Target} shown as an element's inline style. Every animation on it works as on any
 * target; one that runs alone on it, with no `onTick`, and whose CSS is all compositor
 * properties, is handed to `Element.animate` and runs off the main thread, unless its
 * `compositor` option says otherwise.
 */
export function createElementTarget<T>(opts: ElementTargetOptions<T>): Target<T> {
  const { element, style } = opts;
  let held = opts.value as T;
  if (!opts.get && opts.value === undefined) {
    throw new Error('createElementTarget: give `value`, or `get` and `set`');
  }
  const get = opts.get ?? (() => held);
  const set = opts.set ?? ((v: T) => { held = v; });
  const write = (v: unknown): void => writeStyle(element, style(v as T));
  const target = createTarget<T>({ get, set, axes: opts.axes, show: write });
  bindings.set(stateOf(target) as unknown as TargetState, {
    element,
    style: style as (value: unknown) => ElementStyle,
    sampleRate: opts.sampleRate ?? 60,
    write,
  });
  return target;
}
