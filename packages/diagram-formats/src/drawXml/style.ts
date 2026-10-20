/**
 * A draw-style XML cell's style string: `key=value` pairs and bare style
 * names, each ending in a semicolon, as in `ellipse;fillColor=#fff;`.
 */

/** A parsed style string: its bare names in order, and its pairs, a later one winning. */
export interface CellStyle {
  names: readonly string[];
  values: ReadonlyMap<string, string>;
}

/** Reads a style string. A missing one is empty. */
export function parseStyle(text: string | null | undefined): CellStyle {
  const names: string[] = [];
  const values = new Map<string, string>();
  for (const token of (text ?? '').split(';')) {
    const part = token.trim();
    if (part === '') continue;
    const eq = part.indexOf('=');
    if (eq < 0) names.push(part);
    else values.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return { names, values };
}

/** A pair's value as a number, or `undefined` when it is missing or not one. */
export function styleNumber(style: CellStyle, key: string): number | undefined {
  const raw = style.values.get(key);
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Whether a pair is set to `1`. */
export const styleFlag = (style: CellStyle, key: string): boolean => style.values.get(key) === '1';

/** Whether the style has `name` as a bare name, or as its `shape`. */
export const hasStyleName = (style: CellStyle, name: string): boolean =>
  style.names.includes(name) || style.values.get('shape') === name;

/** The shape a style draws: its `shape` pair, else its first bare name. */
export function shapeOf(style: CellStyle): string | undefined {
  return style.values.get('shape') ?? style.names[0];
}

/** One part of a style to write: a bare name, or a pair, left out when its value is `undefined`. */
export type StylePart = string | readonly [string, string | number | undefined];

/** Writes a style string, every part ending in a semicolon. A value loses any semicolon, which would end it early. */
export function writeStyle(parts: readonly StylePart[]): string {
  let out = '';
  for (const part of parts) {
    if (typeof part === 'string') out += `${part.replace(/[;=]/g, '')};`;
    else if (part[1] !== undefined) out += `${part[0]}=${String(part[1]).replace(/;/g, '')};`;
  }
  return out;
}
