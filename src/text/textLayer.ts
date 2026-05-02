/**
 * Text RenderLayer. Draws each text node into world space using the node's
 * pose rect and resolved style. Wrap is width-driven (`pose.width`); height
 * is informational — overflow is not clipped at v1. Callers compose this
 * layer like any other via `runLayers`.
 */

import { applyPaint } from '../paint';
import type { RenderLayer } from '../renderLayer';
import { measureText } from './measureText';
import {
  type ResolvedTextStyle,
  type TextStyle,
  fontString,
  resolveTextStyle,
} from './textStyle';

export interface TextPose {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  style?: TextStyle;
}

export interface CreateTextLayerOpts<T> {
  id?: string;
  label?: string;
  getTexts: () => readonly T[];
  getPose: (node: T) => TextPose;
  /** Optional per-node hide hook (e.g., suppress while editing). */
  isHidden?: (node: T) => boolean;
}

export function createTextLayer<T>(opts: CreateTextLayerOpts<T>): RenderLayer<unknown> {
  const { id = 'text', label = 'Text', getTexts, getPose, isHidden } = opts;
  return {
    id,
    label,
    draw: (ctx) => {
      for (const node of getTexts()) {
        if (isHidden?.(node)) continue;
        const pose = getPose(node);
        const style = resolveTextStyle(pose.style);
        ctx.save();
        ctx.font = fontString(style);
        applyPaint(ctx, style.fill, { x: pose.x, y: pose.y });
        ctx.textBaseline = 'top';
        ctx.textAlign = style.align;
        const { lines } = measureText(ctx, pose.text, pose.width, style);
        const lineHeightPx = style.fontSize * style.lineHeight;
        const xAnchor = anchorX(pose.x, pose.width, style);
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], xAnchor, pose.y + i * lineHeightPx);
        }
        ctx.restore();
      }
    },
  };
}

function anchorX(x: number, width: number, style: ResolvedTextStyle): number {
  switch (style.align) {
    case 'center':
      return x + width / 2;
    case 'right':
      return x + width;
    default:
      return x;
  }
}
