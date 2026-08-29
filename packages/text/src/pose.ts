import type { StyledRun } from './runs';
import type { TextStyle } from './textStyle';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import type { TextVerticalAlign } from './measure/verticalAlign';

/** Pose for a text node: bounding rect plus the text and optional style. */
export interface TextPose {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  /** Rich-text runs. When present, `runsToPlainText(runs)` must equal `text`. */
  runs?: StyledRun[];
  style?: TextStyle;
  /** Glyph paint — the same `data.fill` / `data.stroke` a scene text node
   *  carries. Not part of `style`: paint is not typography. */
  fill?: FillStyle | null;
  stroke?: Stroke | null;
  /** Box vertical alignment within `[y, y+height]`. Default 'top'. */
  verticalAlign?: TextVerticalAlign;
}
