/**
 * The decoration and script metrics a font states for itself, in the kit's
 * units: em fractions, with a rule's `offset` measured *down* from the
 * baseline to its top edge (y grows down) and a script's `shift` positive
 * for a rise.
 *
 * Both glyph tiers carry the same record — an atlas bakes it into its JSON,
 * a parsed face reads it off the font's tables — and both derive it through
 * {@link faceMetricsFromTables}, so one font yields one set of numbers
 * whichever tier ends up serving a run.
 */
import type { ResolveResult } from './registerFont';

/** One rule: the top edge's distance below the baseline, and its weight. */
export interface FaceRuleMetrics {
  readonly offset: number;
  readonly thickness: number;
}

/** One script preset: `size` scales the inherited font size, `shift` raises
 *  (positive) or lowers (negative) the baseline, in inherited ems. */
export interface FaceScriptMetrics {
  readonly size: number;
  readonly shift: number;
}

/** What a face says about its rules and scripts. Every field is optional:
 *  a font may carry some of these tables and not others. */
export interface FaceMetrics {
  readonly underline?: FaceRuleMetrics;
  readonly strikethrough?: FaceRuleMetrics;
  readonly superscript?: FaceScriptMetrics;
  readonly subscript?: FaceScriptMetrics;
}

/** The table fields {@link faceMetricsFromTables} reads, in font units, as
 *  the OpenType `post` and `OS/2` tables state them. */
export interface FaceMetricTables {
  unitsPerEm: number;
  post?: { underlinePosition?: number; underlineThickness?: number };
  os2?: {
    yStrikeoutPosition?: number;
    yStrikeoutSize?: number;
    ySuperscriptYSize?: number;
    ySuperscriptYOffset?: number;
    ySubscriptYSize?: number;
    ySubscriptYOffset?: number;
  };
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Convert raw table values to {@link FaceMetrics}.
 *
 * `post.underlinePosition` and `OS/2.yStrikeoutPosition` are the rule's top
 * edge, positive above the baseline. `ySubscriptYOffset` is positive
 * *downward*, unlike its superscript twin. A zero weight or size is a font
 * that left the field blank, not one asking for an invisible rule, so that
 * entry is dropped and the caller's default applies.
 */
export function faceMetricsFromTables(t: FaceMetricTables): FaceMetrics | undefined {
  const upem = t.unitsPerEm;
  if (!finite(upem) || upem <= 0) return undefined;
  const out: {
    underline?: FaceRuleMetrics; strikethrough?: FaceRuleMetrics;
    superscript?: FaceScriptMetrics; subscript?: FaceScriptMetrics;
  } = {};
  const rule = (position: unknown, thickness: unknown): FaceRuleMetrics | undefined =>
    finite(position) && finite(thickness) && thickness > 0
      ? { offset: -position / upem, thickness: thickness / upem }
      : undefined;
  const script = (size: unknown, shift: unknown): FaceScriptMetrics | undefined =>
    finite(size) && finite(shift) && size > 0
      ? { size: size / upem, shift: shift / upem }
      : undefined;
  const underline = rule(t.post?.underlinePosition, t.post?.underlineThickness);
  const strikethrough = rule(t.os2?.yStrikeoutPosition, t.os2?.yStrikeoutSize);
  const superscript = script(t.os2?.ySuperscriptYSize, t.os2?.ySuperscriptYOffset);
  const sub = t.os2?.ySubscriptYOffset;
  const subscript = script(t.os2?.ySubscriptYSize, finite(sub) ? -sub : sub);
  if (underline) out.underline = underline;
  if (strikethrough) out.strikethrough = strikethrough;
  if (superscript) out.superscript = superscript;
  if (subscript) out.subscript = subscript;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Validate an atlas JSON's `faceMetrics` block. Absent is fine — atlases
 * baked before the block existed carry none. Present and malformed throws,
 * naming the entry, as the rest of `parseBmFont` does.
 */
export function parseFaceMetrics(raw: unknown): FaceMetrics | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'object' || raw === null) throw new Error('parseBmFont: faceMetrics must be an object');
  const r = raw as Record<string, unknown>;
  const out: Record<string, FaceRuleMetrics | FaceScriptMetrics> = {};
  const pair = (key: string, a: string, b: string, positive: string): void => {
    const v = r[key];
    if (v === undefined) return;
    const e = v as Record<string, unknown> | null;
    if (typeof e !== 'object' || e === null || !finite(e[a]) || !finite(e[b]) || (e[positive] as number) <= 0) {
      throw new Error(`parseBmFont: malformed faceMetrics.${key}`);
    }
    out[key] = { [a]: e[a], [b]: e[b] } as unknown as FaceRuleMetrics | FaceScriptMetrics;
  };
  pair('underline', 'offset', 'thickness', 'thickness');
  pair('strikethrough', 'offset', 'thickness', 'thickness');
  pair('superscript', 'size', 'shift', 'size');
  pair('subscript', 'size', 'shift', 'size');
  return Object.keys(out).length > 0 ? (out as FaceMetrics) : undefined;
}

/**
 * The face metrics behind a resolved run — the outline face's on the outline
 * tier, the atlas's on the atlas tier. The canvas tier rasterizes through
 * `CanvasRenderingContext2D`, which exposes no font tables, so it has none
 * and callers fall back to their defaults.
 */
export function faceMetricsOf(result: ResolveResult): FaceMetrics | undefined {
  return result.outlineFace?.faceMetrics ?? result.entry?.font.faceMetrics;
}
