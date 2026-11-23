import { layoutTextPose, type ResolvedTextStyle } from '@weasel-js/text';
import type { TextEditScreenPose } from './textEditTypes';

/**
 * The canvas and CSS both hang a line's baseline half the leading plus one
 * ascent below the line top, from the same ascent rule, but each engine
 * rounds the font's metrics and that leading its own way, and a face that
 * states no ascent and descent hangs from its ascent alone. So the difference
 * is read from both sides rather than predicted: the canvas's from its own layout, the
 * overlay's from a zero-height inline box on a hidden line set exactly as the
 * overlay is. Pre-scale; `0` when either side has nothing to measure.
 * @internal
 */
export function baselineDrop(el: HTMLElement, style: ResolvedTextStyle, pose: TextEditScreenPose, lineHeight: number): number {
  const canvas = layoutTextPose({
    x: 0, y: 0, width: pose.width, height: pose.height, text: ' ',
    style: {
      fontFamily: style.fontFamily, fontWeight: style.fontWeight, fontStyle: style.fontStyle,
      fontSize: pose.fontSize, lineHeight, script: style.script,
    },
  }).laid.lines[0]?.baselineY ?? 0;
  const css = cssBaseline(el);
  return canvas > 0 && css > 0 ? canvas - css : 0;
}

const CSS_BASELINES = new Map<string, number>();

function cssBaseline(el: HTMLElement): number {
  const parent = el.parentElement;
  if (!parent) return 0;
  const { fontFamily, fontWeight, fontStyle, fontSize, lineHeight, textRendering } = el.style;
  const key = [fontFamily, fontWeight, fontStyle, fontSize, lineHeight, textRendering].join('|');
  const cached = CSS_BASELINES.get(key);
  if (cached !== undefined) return cached;
  const line = document.createElement('div');
  Object.assign(line.style, {
    position: 'absolute', left: '0', top: '0', width: '100px', margin: '0', padding: '0', border: '0',
    visibility: 'hidden', whiteSpace: 'pre', fontFamily, fontWeight, fontStyle, fontSize, lineHeight, textRendering,
  });
  const mark = document.createElement('span');
  Object.assign(mark.style, { display: 'inline-block', width: '0', height: '0', verticalAlign: 'baseline' });
  line.appendChild(mark);
  const [o, ex, ey] = [[0, 0], [100, 0], [0, 100]].map(([x, y]) => {
    const pin = document.createElement('span');
    Object.assign(pin.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: '0', height: '0' });
    line.appendChild(pin);
    return pin;
  });
  parent.appendChild(line);
  const baseline = layoutY(o.getBoundingClientRect(), ex.getBoundingClientRect(), ey.getBoundingClientRect(), mark.getBoundingClientRect());
  line.remove();
  // A web font still loading is measured as its fallback; ask again later.
  if (baseline > 0 && document.fonts?.status !== 'loading') {
    if (CSS_BASELINES.size >= 64) CSS_BASELINES.clear();
    CSS_BASELINES.set(key, baseline);
  }
  return baseline;
}

/** How far below `o` the point `p` sits in layout units, given where the layout points (0, 0), (100, 0) and
 *  (0, 100) land on screen: solving for the whole affine map undoes a turn or skew on an ancestor, not only a scale. */
function layoutY(o: DOMRect, ex: DOMRect, ey: DOMRect, p: DOMRect): number {
  const [ax, ay] = [(ex.left - o.left) / 100, (ex.top - o.top) / 100];
  const [bx, by] = [(ey.left - o.left) / 100, (ey.top - o.top) / 100];
  const det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-9) return 0;
  return (ax * (p.top - o.top) - ay * (p.left - o.left)) / det;
}
