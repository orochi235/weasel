/**
 * Text RenderLayer for text that is not in a scene: one `textCommandFromPose`
 * command per item, the same command the `kit:text` node painter emits, so an
 * item lays out — and wraps, or doesn't, per its style — as a node would.
 *
 * The GL renderer uses MSDF text. The resolved style's `fontFamily` must
 * be registered via `registerFont(family, variant, metricsUrl, atlasUrl)`
 * from the renderer module *before* the GL backend dispatches this layer.
 * Unregistered families render with a warning and no glyphs (see
 * `TextDrawCommand`'s contract).
 */

import { type DrawCommand } from '../../renderer';
import type { TextPose } from '@weasel-js/text';

import type { RenderLayer } from 'core/layers/render';
import { textCommandFromPose } from './textCommand';
import { runsToPlainText } from '@weasel-js/text';


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
    draw: (_data, view) => {
      // A world-space layer, so a `{ px }` size in a pose's style resolves
      // against the live camera. Radial in effect — one factor for both axes.
      const scale = (view.scale.x + view.scale.y) / 2;
      const children: DrawCommand[] = [];
      for (const node of getTexts()) {
        if (isHidden?.(node)) continue;
        const pose = getPose(node);
        if (pose.runs && pose.runs.length > 0 && runsToPlainText(pose.runs) !== pose.text) {
          throw new Error(
            `weasel createTextLayer: TextPose invariant violated — ` +
            `runsToPlainText(runs) !== text. Either omit \`runs\` or keep it ` +
            `synchronized with \`text\`.`,
          );
        }
        const textCmd = textCommandFromPose(pose, scale);
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
