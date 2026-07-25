/**
 * Text RenderLayer. Emits one TextDrawCommand per text node carrying the
 * node's resolved runs and bounding rect. Word wrap and multi-line layout
 * happen downstream in `drawText` / `layoutRuns`, not here.
 *
 * The GL renderer uses MSDF text. The resolved style's `fontFamily` must
 * be registered via `registerFont(family, variant, metricsUrl, atlasUrl)`
 * from the renderer module *before* the GL backend dispatches this layer.
 * Unregistered families render with a warning and no glyphs (see
 * `TextDrawCommand`'s contract).
 */

import { type DrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import { resolveRuns } from './runs/resolveRuns';
import { runsToPlainText, toRuns, type StyledRun } from './runs';
import { type TextStyle, resolveTextStyle } from './textStyle';
import type { TextVerticalAlign } from './verticalAlign';

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
  /** Box vertical alignment within `[y, y+height]`. Default 'top'. */
  verticalAlign?: TextVerticalAlign;
}

/** Options for `createTextLayer`. */
export interface CreateTextLayerOpts<T> {
  id?: string;
  label?: string;
  getTexts: () => readonly T[];
  getPose: (node: T) => TextPose;
  /** Optional per-node hide hook (e.g., suppress while editing). */
  isHidden?: (node: T) => boolean;
  /** When `true`, each text command is wrapped in a clipped group so any
   *  overflow beyond the pose's `(width × height)` is hidden. Default
   *  `false` (legacy: text can spill outside the declared bounds). Opt-in
   *  so existing consumers who rely on overflow keep working. */
  clipToBounds?: boolean;
}

/** Build a `RenderLayer` that emits one `TextDrawCommand` per text node. */
export function createTextLayer<T>(opts: CreateTextLayerOpts<T>): RenderLayer<unknown> {
  const { id = 'text', label = 'Text', getTexts, getPose, isHidden, clipToBounds = false } = opts;
  return {
    id,
    label,
    draw: () => {
      const children: DrawCommand[] = [];
      for (const node of getTexts()) {
        if (isHidden?.(node)) continue;
        const pose = getPose(node);
        if (pose.runs && runsToPlainText(pose.runs) !== pose.text) {
          throw new Error(
            `weasel createTextLayer: TextPose invariant violated — ` +
            `runsToPlainText(runs) !== text. Either omit \`runs\` or keep it ` +
            `synchronized with \`text\`.`,
          );
        }
        const style = resolveTextStyle(pose.style);
        const styledRuns = toRuns(pose.runs ?? pose.text);
        const runs = resolveRuns(styledRuns, style);
        const textCmd: DrawCommand = {
          kind: 'text',
          x: pose.x,
          y: pose.y,
          runs,
          maxWidth: pose.width,
          align: style.align,
          style: pose.style ?? {},
          height: pose.height,
          verticalAlign: pose.verticalAlign,
        };
        if (clipToBounds) {
          children.push({
            kind: 'group',
            clip: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
            children: [textCmd],
          });
        } else {
          children.push(textCmd);
        }
      }
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return children;
    },
  };
}
