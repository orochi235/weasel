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
  parent.appendChild(line);
  const box = line.getBoundingClientRect();
  // Rect over layout width undoes any transform on an ancestor.
  const scale = box.width / 100;
  const baseline = scale > 0 ? (mark.getBoundingClientRect().top - box.top) / scale : 0;
  line.remove();
  // A web font still loading is measured as its fallback; ask again later.
  if (baseline > 0 && document.fonts?.status !== 'loading') {
    if (CSS_BASELINES.size >= 64) CSS_BASELINES.clear();
    CSS_BASELINES.set(key, baseline);
  }
  return baseline;
}
