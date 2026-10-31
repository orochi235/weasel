/**
 * Apply node-level `ResolvedTextStyle` defaults to each `StyledRun`,
 * producing a `ResolvedRun` with every styling field set.
 *
 * `bold`/`italic` on a run fold into `fontWeight`/`fontStyle`; a run's own
 * numeric `fontWeight` wins over both the flag and the node weight.
 * `letterSpacing: 0` on a run is an override, not an absence — it zeroes
 * inherited tracking. The decorations are *additive*: a run can turn one on
 * but never off, so they resolve as `run.x || style.x`.
 *
 * `script` folds into the two primitives it is a preset over, and comes out
 * as one world-unit `baselineShift` and a final `fontSize`. `textTransform`
 * is applied here, then small caps over the transformed text.
 */

import type { Stroke, Fill } from '@weasel-js/paint';
import { resolveScreenLength } from '@weasel-js/paint';
import { faceMetricsOf, cachedFontVariant, type FaceMetrics, type FontStyle } from '@weasel-js/font';
import type { StyledRun } from '../runs';
import type { ResolvedTextStyle } from '../textStyle';
import { transformRunTexts, type RunSourceMap } from './textTransform';
import { smallCapsScaleFor, smallCapsText } from './smallCaps';
import { shapesWithFeature } from '../layout/shaperRegistry';

/** A run with every style resolved against the node's text style — no
 *  optional inheritance left. This is what layout and painting consume. */
export interface ResolvedRun {
  /** The text as drawn — after `textTransform`, so not necessarily the
   *  run's source text. */
  text: string;
  /** Present when `text` differs in length from the source it was
   *  transformed from: where each of its UTF-16 units came from. Absent
   *  means `text`'s offsets are the source's. */
  srcMap?: RunSourceMap;
  fontFamily: string;
  /** The run's size — what its line and its rules are set at, and what
   *  every glyph is drawn at unless `sizeMap` says otherwise. */
  fontSize: number;
  /** Present when not every glyph is drawn at `fontSize`: the size each
   *  UTF-16 unit of `text` is drawn at. Small caps is what produces one. */
  sizeMap?: readonly number[];
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  /** `null` is an explicit no-fill: the glyphs are painted by `stroke` alone,
   *  which only the outline tier can do. Nothing is emitted for a run with
   *  neither. */
  fill: Fill | null;
  /** Outline over this run's glyphs, or absent for none. Painted only on the
   *  outline tier — a distance field has no geometry to stroke. */
  stroke?: Stroke;
  /** Extra advance added after each glyph of this run, in world units. */
  letterSpacing: number;
  /** Draw a rule below this run's baseline. Additive over the node style. */
  underline: boolean;
  /** Draw a rule through this run's x-height. Additive over the node style. */
  strikethrough: boolean;
  /** Draw a rule above this run's ascent. Additive over the node style. */
  overline: boolean;
  /**
   * How far this run sits off the line's shared baseline, in world units;
   * positive raises. 0 for ordinary text. Already carries whatever `script`
   * asked for.
   */
  baselineShift: number;
  /**
   * The size this run holds its line open at, when a relative size shrank it
   * below the size it inherited — so a superscript alone on its line keeps the
   * line's height and baseline instead of collapsing them. Absent means
   * `fontSize`.
   */
  strutSize?: number;
  /** Degrees each glyph turns, clockwise about its pen on the baseline.
   *  Absent is upright. */
  rotate?: number;
  /** OpenType features a shaper turns on for this run (`'smcp'` for small
   *  caps drawn from the face's own glyphs). Absent is none; a run that is not
   *  shaped ignores it. */
  fontFeatures?: readonly string[];
  /** BCP 47 language tag a shaper selects the face's forms by: the run's own,
   *  else the node's. Absent is none. */
  lang?: string;
}

const SMALL_CAPS_FEATURES: readonly string[] = Object.freeze(['smcp']);

/** What one script preset expands to. */
export type ScriptPreset = Readonly<{ size: number; shift: number }>;

/**
 * What `script: 'super'` and `script: 'sub'` expand to for a face that states
 * no script metrics of its own, as fractions of the inherited font size:
 * `size` scales it, `shift` raises (positive) or lowers (negative) the
 * baseline. These are Adobe's defaults. A face that carries `OS/2` script
 * metrics uses those instead; {@link scriptMetricsFor} is what a run gets.
 */
export const SCRIPT_METRICS: Readonly<Record<'super' | 'sub', ScriptPreset>> = Object.freeze({
  super: Object.freeze({ size: 0.583, shift: 0.333 }),
  sub: Object.freeze({ size: 0.583, shift: -0.333 }),
});

const resolvedScripts = new WeakMap<FaceMetrics, Readonly<Record<'super' | 'sub', ScriptPreset>>>();

/** The script presets for a face: its own `OS/2` values where it states
 *  them, {@link SCRIPT_METRICS} per half where it does not. */
export function scriptMetrics(face?: FaceMetrics): Readonly<Record<'super' | 'sub', ScriptPreset>> {
  if (!face || (!face.superscript && !face.subscript)) return SCRIPT_METRICS;
  let out = resolvedScripts.get(face);
  if (!out) {
    out = Object.freeze({
      super: face.superscript ?? SCRIPT_METRICS.super,
      sub: face.subscript ?? SCRIPT_METRICS.sub,
    });
    resolvedScripts.set(face, out);
  }
  return out;
}

/**
 * The script presets a run set in `(family, weight, style)` gets — resolved
 * through the font registry exactly as layout resolves the run. Override
 * either half per run with `baselineShift` / `fontScale`.
 */
export function scriptMetricsFor(
  family: string,
  weight: number,
  style: FontStyle,
): Readonly<Record<'super' | 'sub', ScriptPreset>> {
  return scriptMetrics(faceMetricsOf(cachedFontVariant(family, weight, style)));
}

/**
 * How far below the top of a line box a face's ascent starts, CSS's way: half
 * the leading a line height of `lineHeight` (a multiple of `fontSize`) leaves
 * around the face's ascent and descent, in the units `fontSize` is in. It is
 * negative for a face taller than its line. `undefined` when no registered
 * face of `(family, weight, style)` states its ascent and descent.
 */
export function halfLeadingFor(
  family: string,
  weight: number,
  style: FontStyle,
  fontSize: number,
  lineHeight: number,
): number | undefined {
  const m = faceMetricsOf(cachedFontVariant(family, weight, style));
  if (m?.ascent === undefined || m.descent === undefined) return undefined;
  return ((lineHeight - m.ascent - m.descent) / 2) * fontSize;
}

/** A `TextStyle.fontWeight` as a number: the CSS keywords `bold` and
 *  `normal` read as 700 and 400, anything unparseable as 400. */
export function numericWeight(w: number | string): number {
  if (typeof w === 'number') return w;
  if (w === 'bold' || w === 'bolder') return 700;
  if (w === 'normal') return 400;
  const parsed = Number(w);
  return Number.isFinite(parsed) ? parsed : 400;
}

/** Whether a weight reads as bold — 600 and up, the same line the font
 *  registry draws between its regular and bold buckets. */
export function isBoldWeight(w: number | string): boolean {
  return numericWeight(w) >= 600;
}

/** The face a run is set in — its family, weight and style, each falling
 *  back to the node's. Reads no font registry, so asking loads nothing. */
export function resolveRunFace(
  run: StyledRun,
  style: Pick<ResolvedTextStyle, 'fontFamily' | 'fontWeight' | 'fontStyle'>,
): { fontFamily: string; fontWeight: number; fontStyle: FontStyle } {
  return {
    fontFamily: run.fontFamily ?? style.fontFamily,
    fontWeight: run.fontWeight ?? (run.bold ? 700 : numericWeight(style.fontWeight)),
    fontStyle: run.italic ? 'italic' : style.fontStyle,
  };
}

/** Resolve each run's styling against the node's text style, filling in
 *  everything the run left inherited. `viewScale` resolves a run's own
 *  `{ px }` size or spacing; the inherited ones arrived already resolved on
 *  `style`. */
export function resolveRuns(
  runs: readonly StyledRun[],
  style: ResolvedTextStyle,
  viewScale = 1,
): ResolvedRun[] {
  // Sized up front: pushing onto `[]` gives even a one-run array room for 17.
  return resolveRunsInto(new Array<ResolvedRun>(runs.length), runs, style, viewScale);
}

/**
 * {@link resolveRuns} into `out`, which is refilled in place and returned: a
 * run already at an index is rewritten when it has the same optional fields as
 * its replacement. For a caller that owns `out` and hands nothing it held
 * to anyone who keeps it; one whose runs the text caches have seen calls
 * `clearRuns` on them first.
 */
export function resolveRunsInto(
  out: ResolvedRun[],
  runs: readonly StyledRun[],
  style: ResolvedTextStyle,
  viewScale = 1,
): ResolvedRun[] {
  if (out.length !== runs.length) out.length = runs.length;
  let transformed = false;
  for (const r of runs) if ((r.textTransform ?? style.textTransform) !== 'none') transformed = true;
  const shown = transformed
    ? transformRunTexts(
      runs.map((r) => r.text),
      runs.map((r) => r.textTransform ?? style.textTransform),
      runs.map((r) => r.lang ?? style.lang),
    )
    : null;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    let text = shown ? shown[i].text : run.text;
    let srcMap = shown?.[i].srcMap;
    const scriptKey = run.script ?? style.script;
    const { fontFamily, fontWeight, fontStyle } = resolveRunFace(run, style);
    const script = scriptKey ? scriptMetricsFor(fontFamily, fontWeight, fontStyle)[scriptKey] : undefined;
    // Against the inherited size, not the run's own: a superscript that also
    // shrank its rise would climb less the smaller it got.
    const shiftEm = run.baselineShift ?? script?.shift ?? 0;
    const scale = run.fontScale ?? script?.size ?? 1;
    const relative = run.fontSize === undefined && scale !== 1;
    // An absolute size wins over a relative one.
    const fontSize = run.fontSize !== undefined
      ? resolveScreenLength(run.fontSize, viewScale)
      : style.fontSize * scale;
    let sizeMap: number[] | undefined;
    let fontFeatures: readonly string[] | undefined;
    const smallCaps = (run.fontVariantCaps ?? style.fontVariantCaps) === 'small-caps';
    // A face with small capitals of its own draws them; the rest are synthesized.
    if (smallCaps && shapesWithFeature(fontFamily, fontWeight, fontStyle, 'smcp')) {
      fontFeatures = SMALL_CAPS_FEATURES;
    } else if (smallCaps) {
      const caps = smallCapsText(text, srcMap, run.lang ?? style.lang);
      text = caps.text;
      srcMap = caps.srcMap;
      if (caps.small) {
        const small = fontSize * smallCapsScaleFor(fontFamily, fontWeight, fontStyle);
        sizeMap = caps.small.map((s) => (s ? small : fontSize));
      }
    }
    const lang = run.lang ?? style.lang;
    const fill = run.fill !== undefined ? run.fill : style.fill;
    const letterSpacing = run.letterSpacing !== undefined
      ? resolveScreenLength(run.letterSpacing, viewScale)
      : style.letterSpacing;
    // `||`, not `??`: run-level decorations are additive over the node style.
    const underline = run.underline || style.underline;
    const strikethrough = run.strikethrough || style.strikethrough;
    const overline = run.overline || style.overline;
    // Unlike the decorations, a run's stroke *replaces* the node's rather
    // than adding to it — there is only one outline to paint.
    const stroke = run.stroke ?? style.stroke;
    const rotate = run.rotate && Number.isFinite(run.rotate) ? run.rotate : undefined;
    const prev = out[i];
    // Rewritten only at the same shape: deleting a field would leave it a dictionary.
    if (prev !== undefined && (prev.srcMap !== undefined) === (srcMap !== undefined)
      && (prev.sizeMap !== undefined) === (sizeMap !== undefined)
      && (prev.stroke !== undefined) === (stroke !== undefined)
      && (prev.strutSize !== undefined) === relative && (prev.rotate !== undefined) === (rotate !== undefined)
      && (prev.fontFeatures !== undefined) === (fontFeatures !== undefined) && (prev.lang !== undefined) === !!lang) {
      prev.text = text; prev.fontFamily = fontFamily; prev.fontSize = fontSize; prev.fontWeight = fontWeight;
      prev.fontStyle = fontStyle; prev.fill = fill; prev.letterSpacing = letterSpacing; prev.underline = underline;
      prev.strikethrough = strikethrough; prev.overline = overline; prev.baselineShift = shiftEm * style.fontSize;
      if (srcMap) prev.srcMap = srcMap;
      if (sizeMap) prev.sizeMap = sizeMap;
      if (stroke !== undefined) prev.stroke = stroke;
      if (relative) prev.strutSize = style.fontSize;
      if (rotate !== undefined) prev.rotate = rotate;
      if (fontFeatures) prev.fontFeatures = fontFeatures;
      if (lang) prev.lang = lang;
      continue;
    }
    // Every field every run has, in one literal, and only then the optional
    // ones: a spread in the literal grew the run's property store field by field.
    const r: ResolvedRun = {
      text, fontFamily, fontSize, fontWeight, fontStyle, fill, letterSpacing,
      underline, strikethrough, overline, baselineShift: shiftEm * style.fontSize,
    };
    if (srcMap) r.srcMap = srcMap;
    if (sizeMap) r.sizeMap = sizeMap;
    if (stroke !== undefined) r.stroke = stroke;
    if (relative) r.strutSize = style.fontSize;
    if (rotate !== undefined) r.rotate = rotate;
    if (fontFeatures) r.fontFeatures = fontFeatures;
    if (lang) r.lang = lang;
    out[i] = r;
  }
  return out;
}
