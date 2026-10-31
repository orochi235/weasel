/** A Mermaid quadrant chart's statements read into the parts of its spec. */
import type { QuadrantAxis, QuadrantPoint, QuadrantPointStyle } from '@weasel-js/plot';
import { lineError } from '../../lineError';
import type { Statement } from '../common/lines';
import { unquote } from '../xychart/parse';

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** Text bare or in double quotes, its quotes and Mermaid's `#quot;` read. */
export const textOf = (s: string): string => {
  const t = s.trim();
  return t.length > 1 && t.startsWith('"') && t.endsWith('"') ? unquote(t) : t;
};

function numberAt(text: string, line: number): number {
  if (!NUMBER.test(text)) throw lineError('Mermaid', line, `"${text}" is not a number`);
  return Number(text);
}

/** `Low --> High`, `Low -->` or `Low` as an axis's ends. */
export function axisOf(rest: string): QuadrantAxis {
  const at = rest.indexOf('-->');
  const low = textOf(at < 0 ? rest : rest.slice(0, at));
  const high = at < 0 ? '' : textOf(rest.slice(at + 3));
  return { ...(low !== '' ? { low } : {}), ...(high !== '' ? { high } : {}) };
}

/** `radius: 10, color: #ff3300, stroke-color: #10f0f0, stroke-width: 5px` as a style. Throws, naming the line, on
 *  anything else. */
export function styleOf(text: string, line: number): QuadrantPointStyle {
  const style: QuadrantPointStyle = {};
  for (const part of text.split(',').map((p) => p.trim()).filter((p) => p !== '')) {
    const m = /^([\w-]+)\s*:\s*(\S+)$/.exec(part);
    if (m === null) throw lineError('Mermaid', line, `"${part}" is not a point style`);
    const key = m[1]!;
    const value = m[2]!;
    switch (key) {
      case 'radius': style.radius = numberAt(value, line); break;
      case 'color': style.color = value; break;
      case 'stroke-color': style.strokeColor = value; break;
      case 'stroke-width': style.strokeWidth = numberAt(value.replace(/px$/, ''), line); break;
      default: throw lineError('Mermaid', line, `"${key}" is not a point style`);
    }
  }
  return style;
}

const POINT = /^(.+?)(?::::([\w-]+))?\s*:\s*\[([^\]]*)\](.*)$/;

/** `Name:::class: [x, y] styles` as a point, or `null` for a line that is not one. Throws, naming the line, on
 *  coordinates that are not numbers from 0 to 1. */
export function pointOf(s: Statement): QuadrantPoint | null {
  const m = POINT.exec(s.text);
  if (m === null) return null;
  const coords = m[3]!.split(',').map((c) => c.trim());
  if (coords.length !== 2) throw lineError('Mermaid', s.line, `a point takes [x, y], not [${m[3]}]`);
  const [x, y] = coords.map((c) => numberAt(c, s.line)) as [number, number];
  if (x < 0 || x > 1 || y < 0 || y > 1) throw lineError('Mermaid', s.line, `a point's x and y run from 0 to 1, and [${coords.join(', ')}] does not`);
  const style = styleOf(m[4]!, s.line);
  return {
    name: textOf(m[1]!), x, y,
    ...(m[2] !== undefined ? { className: m[2] } : {}),
    ...(Object.keys(style).length > 0 ? { style } : {}),
  };
}
