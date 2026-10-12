import { escapeMarkup as escape, textOf, type Part } from './kind';
import { partsOf, partsToHtml, present, type PresentOptions, type Presentation } from './present';
import { amount, type Display, type Quantity } from './quantity';

/** Options for presenting a range. */
export interface RangeOptions extends PresentOptions {
  /** What goes between the ends. Default an en dash, spaced when an end is negative. */
  separator?: string;
  /** The separator read aloud. Default ` to `. */
  spokenSeparator?: string;
}

/** Options for presenting a vector. */
export interface VectorOptions extends PresentOptions {
  /** What goes between members. Default `, `. */
  separator?: string;
  /** A name before each member, by position: `['x', 'y']`. */
  labels?: readonly string[];
}

const SEPARATOR = 'separator';

/** Part types that say what a value is measured in, rather than how much. */
const MEASURE = new Set(['unit', 'percentSign']);

/** The trailing parts of a value that name its measure: `ft` in `2ft`, with any space before it. */
function measureTail(parts: readonly Part[]): Part[] {
  let at = parts.length;
  while (at > 0 && (MEASURE.has(parts[at - 1]!.type) || parts[at - 1]!.type === 'literal')) at--;
  const tail = parts.slice(at);
  return tail.some((p) => MEASURE.has(p.type)) ? tail : [];
}

/** Each end's own parts, with a measure both ends close on left off the first. */
function rangeEnds(from: Quantity, to: Quantity, fallback?: Display, options?: PresentOptions): [Part[], Part[]] {
  const a = partsOf(from, fallback, options);
  const b = partsOf(to, fallback, options);
  const tail = measureTail(a);
  const shared = tail.length > 0 && textOf(tail) === textOf(measureTail(b));
  return [shared ? a.slice(0, a.length - tail.length) : a, b];
}

function rangeSeparator(from: Quantity, to: Quantity, options?: RangeOptions): string {
  return options?.separator ?? (amount(from) < 0 || amount(to) < 0 ? ' – ' : '–');
}

/**
 * A range as one run of parts: both ends under their own display, else
 * `fallback`, around a `separator` part. A unit or percent sign both ends
 * share is written once, after the second: `2–5ft`.
 */
export function rangeParts(from: Quantity, to: Quantity, fallback?: Display, options?: RangeOptions): Part[] {
  const [a, b] = rangeEnds(from, to, fallback, options);
  return [...a, { type: SEPARATOR, value: rangeSeparator(from, to, options) }, ...b];
}

/** A range as text, spoken text, and HTML: a `data-composite="range"` span
 *  holding a `<data value>` for each end and a `separator` part between. */
export function presentRange(from: Quantity, to: Quantity, fallback?: Display, options?: RangeOptions): Presentation {
  const [a, b] = rangeEnds(from, to, fallback, options);
  const separator = rangeSeparator(from, to, options);
  const spoken = [from, to].map((q) => present(q, fallback, options).spoken);
  return {
    text: `${textOf(a)}${separator}${textOf(b)}`,
    spoken: spoken.join(options?.spokenSeparator ?? ' to '),
    html: compositeHtml('range', [partsToHtml(amount(from), a), partsToHtml(amount(to), b)], separator),
  };
}

/** A vector as one run of parts: every member under its own display, else
 *  `fallback`, with a `separator` part between and a `label` part before each
 *  member that has one. */
export function vectorParts(members: readonly Quantity[], fallback?: Display, options?: VectorOptions): Part[] {
  const separator = options?.separator ?? ', ';
  return members.flatMap((q, i) => [
    ...(i > 0 ? [{ type: SEPARATOR, value: separator }] : []),
    ...labelParts(options?.labels?.[i]),
    ...partsOf(q, fallback, options),
  ]);
}

/** A vector as text, spoken text, and HTML: a `data-composite="vector"` span
 *  holding a `<data value>` for each member. */
export function presentVector(members: readonly Quantity[], fallback?: Display, options?: VectorOptions): Presentation {
  const separator = options?.separator ?? ', ';
  const label = (i: number): string => textOf(labelParts(options?.labels?.[i]));
  return {
    text: textOf(vectorParts(members, fallback, options)),
    spoken: members.map((q, i) => `${label(i)}${present(q, fallback, options).spoken}`).join(separator),
    html: compositeHtml(
      'vector',
      members.map((q, i) => `${partsHtml(labelParts(options?.labels?.[i]))}${present(q, fallback, options).html}`),
      separator,
    ),
  };
}

function labelParts(label: string | undefined): Part[] {
  return label === undefined ? [] : [{ type: 'label', value: label }, { type: 'literal', value: ' ' }];
}

function partsHtml(parts: readonly Part[]): string {
  return parts
    .map((p) => (p.type === 'literal' ? escape(p.value) : `<span data-part="${escape(p.type)}">${escape(p.value)}</span>`))
    .join('');
}

function compositeHtml(kind: string, members: readonly string[], separator: string): string {
  const between = partsHtml([{ type: SEPARATOR, value: separator }]);
  return `<span data-composite="${kind}">${members.join(between)}</span>`;
}
