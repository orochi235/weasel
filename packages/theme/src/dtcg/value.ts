import type { TokenValue } from './types';

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
      .map((f) => f.trim().replace(/^['"]|['"]$/g, '').trim())
      .filter((f) => f !== '');
    return families.length > 0 ? families : raw;
  }
  return raw;
}
