import { cssColorNotation, rgbaToHex } from '@weasel-js/paint';
import type { TokenValue } from './types.ts';

/**
 * Quote family names containing whitespace; leave everything else bare.
 * Generic keywords (`sans-serif`) and hyphen-prefixed identifiers
 * (`-apple-system`) break if quoted, and neither contains a space.
 */
function fontStack(value: readonly (string | number)[]): string {
  return value.map((f) => (typeof f === 'string' && /\s/.test(f) ? `'${f}'` : String(f))).join(', ');
}

/**
 * A token's value as CSS renders it. A DTCG value is not always a string: a
 * `fontFamily` is a list of names and a `cubicBezier` is four numbers, and both
 * have a spelling that belongs in a stylesheet rather than in JSON.
 */
export function serializeTokenValue(type: string, value: TokenValue): string {
  if (Array.isArray(value)) {
    if (type === 'cubicBezier') return `cubic-bezier(${value.join(', ')})`;
    if (type === 'fontFamily') return fontStack(value);
    return value.join(', ');
  }
  return String(value);
}

const BEZIER = /^cubic-bezier\(\s*([^)]*)\)$/i;

/**
 * The inverse of {@link serializeTokenValue}: text a person edited, back in the
 * shape a definition stores. Text that does not parse for its type is kept as
 * text rather than thrown away, so a half-typed value stays editable.
 */
export function parseTokenValue(type: string, text: string): TokenValue {
  const raw = text.trim();
  if (type === 'cubicBezier') {
    const inner = BEZIER.exec(raw)?.[1] ?? raw;
    const parts = inner.split(',').map((p) => Number(p.trim()));
    return parts.length === 4 && parts.every((n) => Number.isFinite(n)) ? parts : raw;
  }
  if (type === 'fontFamily') {
    const families = raw
      .split(',')
      .map((f) => f.trim().replace(/^(['"])(.*)\1$/s, '$2').trim())
      .filter((f) => f !== '');
    return families.length > 0 ? families : raw;
  }
  return raw;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A DTCG color object in CSS's own notation for its space: hex for an in-gamut sRGB color, nothing converted. */
function colorObject(v: Record<string, unknown>): string | undefined {
  const { colorSpace: space, components, alpha = 1 } = v;
  if (typeof space !== 'string' || !Array.isArray(components) || components.length !== 3) return undefined;
  if (!components.every((c) => (typeof c === 'number' && Number.isFinite(c)) || c === 'none')) return undefined;
  if (typeof alpha !== 'number' || !(alpha >= 0 && alpha <= 1)) return undefined;
  const [r, g, b] = components as unknown[];
  if (space === 'srgb' && [r, g, b].every((c) => typeof c === 'number' && c >= 0 && c <= 1)) {
    return rgbaToHex([r as number, g as number, b as number, alpha]);
  }
  return cssColorNotation(space, components as (number | 'none')[], alpha) ?? undefined;
}

/**
 * A DTCG `$value` as a token value: a string, number or list of those passes
 * through, and the object forms of a dimension or duration (`{ value, unit }`)
 * and a color (`{ colorSpace, components, alpha }`) become their CSS spelling.
 * Throws naming `name` for anything else, such as a composite type, which no
 * one custom property can hold.
 */
export function readDtcgValue(name: string, type: string, raw: unknown): TokenValue {
  if (typeof raw === 'string' || typeof raw === 'number') return raw;
  if (Array.isArray(raw) && raw.every((x) => typeof x === 'string' || typeof x === 'number')) return raw as TokenValue;
  if (isRecord(raw)) {
    if ((type === 'dimension' || type === 'duration') && typeof raw.value === 'number' && typeof raw.unit === 'string') {
      return `${raw.value}${raw.unit}`;
    }
    const css = type === 'color' ? colorObject(raw) : undefined;
    if (css !== undefined) return css;
  }
  throw new Error(`Token "${name}" has a ${type} value no CSS custom property can hold: ${JSON.stringify(raw)}`);
}
