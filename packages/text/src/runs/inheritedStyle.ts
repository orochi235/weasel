import { resolveTextStyle } from '../textStyle';
import type { TextPaint, TextStyle } from '../textStyle';
import type { StyledRun } from '../runs';
import { numericWeight } from './resolveRuns';

/** The node a run's absent keys inherit from. */
export interface InheritedStyle {
  style?: TextStyle;
  paint?: TextPaint;
}

type Key = Exclude<keyof StyledRun, 'text'>;

/**
 * `run`'s value at `key` as it renders under `node`: its own where it sets
 * one, else the node's, or `undefined` where the key has no node counterpart
 * (the additive flags, `baselineShift`, `fontScale`, `rotate`).
 */
export function inheritedValue(run: StyledRun, key: Key, node: InheritedStyle): unknown {
  const own = run[key];
  if (own !== undefined) return key === 'fontWeight' ? numericWeight(own as number | string) : own;
  const style = node.style ?? {};
  switch (key) {
    case 'italic': return style.fontStyle === 'italic';
    case 'fontWeight': return run.bold === true ? 700 : numericWeight(style.fontWeight ?? 400);
    case 'fontFamily': case 'fontSize': case 'letterSpacing': case 'textTransform': case 'fontVariantCaps':
      return style[key] ?? resolveTextStyle()[key];
    case 'script': case 'lang': return style[key];
    case 'fill': case 'stroke': return node.paint?.[key] ?? undefined;
    default: return undefined;
  }
}
