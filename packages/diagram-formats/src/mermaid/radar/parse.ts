/** A Mermaid radar's statements, read into the chart they describe. */
import type { RadarAxis, RadarCurve, RadarData } from '@weasel-js/plot';
import { lineError } from '../../lineError';
import type { Statement } from '../common/lines';

const FORMAT = 'Mermaid';
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
/** An axis or a curve: its id, then an optional quoted label in brackets. */
const ITEM = /\s*([A-Za-z_][\w-]*)\s*(?:\[\s*"([^"]*)"\s*\])?\s*/y;

/** A curve whose values name their axes, resolved once every axis is known. */
interface PendingCurve {
  curve: Omit<RadarCurve, 'values'>;
  entries: { axis?: string; value: number }[];
  line: number;
}

function numberAt(text: string, line: number): number {
  if (!NUMBER.test(text)) throw lineError(FORMAT, line, `"${text}" is not a number`);
  return Number(text);
}

/** An id and its label off `text` at `at`, and where it ends; `null` when no id starts there. */
function itemAt(text: string, at: number): { id: string; label?: string; end: number } | null {
  ITEM.lastIndex = at;
  const m = ITEM.exec(text);
  if (m === null) return null;
  return { id: m[1]!, ...(m[2] !== undefined ? { label: m[2] } : {}), end: ITEM.lastIndex };
}

/** `axis a["A"], b, …` as its axes. */
function axesOf(rest: string, line: number): RadarAxis[] {
  const out: RadarAxis[] = [];
  let at = 0;
  for (;;) {
    const item = itemAt(rest, at);
    if (item === null) throw lineError(FORMAT, line, `"${rest.slice(at).trim()}" is not an axis`);
    out.push({ id: item.id, ...(item.label !== undefined ? { label: item.label } : {}) });
    if (item.end >= rest.length) return out;
    if (rest[item.end] !== ',') throw lineError(FORMAT, line, `"${rest.slice(item.end).trim()}" is not an axis`);
    at = item.end + 1;
  }
}

/** `{1, 2}` or `{a: 1, b: 2}` as its entries. */
function entriesOf(body: string, line: number): PendingCurve['entries'] {
  const parts = body.split(',').map((p) => p.trim());
  if (parts.length === 1 && parts[0] === '') return [];
  const entries = parts.map((p) => {
    const keyed = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(p);
    return keyed === null ? { value: numberAt(p, line) } : { axis: keyed[1]!, value: numberAt(keyed[2]!.trim(), line) };
  });
  if (entries.some((e) => e.axis === undefined) && entries.some((e) => e.axis !== undefined)) {
    throw lineError(FORMAT, line, 'a curve\'s values are either all named by axis or none are');
  }
  return entries;
}

/** `curve a["A"]{…}, b{…}` as its curves, their values still to be matched to the axes. */
function curvesOf(rest: string, line: number): PendingCurve[] {
  const out: PendingCurve[] = [];
  let at = 0;
  for (;;) {
    const item = itemAt(rest, at);
    if (item === null || rest[item.end] !== '{') throw lineError(FORMAT, line, `"${rest.slice(at).trim()}" is not a curve`);
    const close = rest.indexOf('}', item.end);
    if (close < 0) throw lineError(FORMAT, line, 'a curve with no closing "}"');
    out.push({ curve: { id: item.id, ...(item.label !== undefined ? { label: item.label } : {}) }, entries: entriesOf(rest.slice(item.end + 1, close), line), line });
    const next = rest.slice(close + 1).trim();
    if (next === '') return out;
    if (!next.startsWith(',')) throw lineError(FORMAT, line, `"${next}" is not a curve`);
    at = rest.indexOf(',', close) + 1;
  }
}

/** A curve's values in axis order. Throws, naming its line, on a count that does not match or an axis left out. */
function resolve(p: PendingCurve, axes: readonly RadarAxis[]): RadarCurve {
  const { curve, entries, line } = p;
  if (entries.every((e) => e.axis === undefined)) {
    if (entries.length !== axes.length) throw lineError(FORMAT, line, `curve "${curve.id}" has ${entries.length} value(s) for ${axes.length} axes`);
    return { ...curve, values: entries.map((e) => e.value) };
  }
  for (const e of entries) {
    if (!axes.some((a) => a.id === e.axis)) throw lineError(FORMAT, line, `curve "${curve.id}" names no axis "${e.axis}"`);
  }
  const values = axes.map((a) => {
    const e = entries.find((x) => x.axis === a.id);
    if (e === undefined) throw lineError(FORMAT, line, `curve "${curve.id}" has no value for axis "${a.id}"`);
    return e.value;
  });
  return { ...curve, values };
}

/** Joins a curve whose braces run over several statements into one. */
function joined(body: readonly Statement[]): Statement[] {
  const out: Statement[] = [];
  for (let k = 0; k < body.length; k++) {
    let s = body[k]!;
    const open = (t: string) => (t.match(/\{/g)?.length ?? 0) - (t.match(/\}/g)?.length ?? 0);
    while (/^curve\b/.test(s.text) && open(s.text) > 0 && k + 1 < body.length) s = { ...s, text: `${s.text} ${body[++k]!.text}` };
    out.push(s);
  }
  return out;
}

/** The chart `body` describes, its `title` statement apart. Throws, naming the line, on a statement it cannot read. */
export function parseRadarBody(body: readonly Statement[]): { data: RadarData; title?: string } {
  const axes: RadarAxis[] = [];
  const pending: PendingCurve[] = [];
  const opts: Partial<Pick<RadarData, 'min' | 'max' | 'ticks' | 'graticule' | 'showLegend'>> = {};
  let title: string | undefined;
  for (const { text, line } of joined(body)) {
    const m = /^(\S+)\s*(.*)$/.exec(text)!;
    const keyword = m[1]!;
    const rest = m[2]!.trim();
    switch (keyword) {
      case 'title': title = rest; break;
      case 'axis': axes.push(...axesOf(rest, line)); break;
      case 'curve': pending.push(...curvesOf(rest, line)); break;
      case 'max':
      case 'min':
      case 'ticks': opts[keyword] = numberAt(rest, line); break;
      case 'graticule':
        if (rest !== 'circle' && rest !== 'polygon') throw lineError(FORMAT, line, `"${rest}" is not a graticule; it is circle or polygon`);
        opts.graticule = rest;
        break;
      case 'showLegend':
        if (rest !== 'true' && rest !== 'false') throw lineError(FORMAT, line, `"${rest}" is not true or false`);
        opts.showLegend = rest === 'true';
        break;
      default:
        throw lineError(FORMAT, line, `"${keyword}" is not a radar statement`);
    }
  }
  const curves = pending.map((p) => resolve(p, axes));
  return { data: { kind: 'radar', axes, curves, ...opts }, ...(title !== undefined ? { title } : {}) };
}
