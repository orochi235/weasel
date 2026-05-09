/**
 * Text RenderLayer. Draws each text node into world space using the node's
 * pose rect and resolved style. Wrap is width-driven (`pose.width`); height
 * is informational — overflow is not clipped at v1.
 *
 * The GL renderer uses MSDF text. The resolved style's `fontFamily` must
 * be registered via `registerFont(family, atlasUrl)` from
 * `@orochi235/weasel-gl` *before* the GL backend dispatches this layer.
 * Unregistered families render with a warning and a fallback glyph (see
 * `TextDrawCommand`'s contract).
 */

import { type DrawCommand, viewToMat3 } from '@orochi235/weasel-gl';
import type { RenderLayer } from '../../core/layers/render';
import { measureText } from './measureText';
import {
  type ResolvedTextStyle,
  type TextStyle,
  fontString,
  resolveTextStyle,
} from './textStyle';

/** Pose for a text node: bounding rect plus the text and optional style. */
export interface TextPose {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  style?: TextStyle;
}

/** Options for `createTextLayer`. */
export interface CreateTextLayerOpts<T> {
  id?: string;
  label?: string;
  getTexts: () => readonly T[];
  getPose: (node: T) => TextPose;
  /** Optional per-node hide hook (e.g., suppress while editing). */
  isHidden?: (node: T) => boolean;
}

/**
 * Lazily-created module-level 2D context used by `draw` for `measureText`.
 * The GL backend has no `ctx`; we keep the existing wrap behavior by
 * borrowing an offscreen 2D canvas just for width measurement.
 *
 * In environments without a real 2D context (jsdom under unit tests), we
 * fall back to a duck-typed stub whose `measureText` returns a
 * character-count-based width. Layout shape is correct; pixel-perfect
 * widths come from real canvas in browsers.
 */
let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (measureCtx !== null) return measureCtx;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(1, 1);
      ctx = oc.getContext('2d') as unknown as CanvasRenderingContext2D | null;
    } else if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      ctx = c.getContext('2d');
    }
  } catch {
    ctx = null;
  }
  if (ctx === null) {
    // Stub for environments (e.g. jsdom) without a real 2D context. Width
    // approximated by character count × an em-style multiplier — wrap
    // shape is preserved, pixel widths are not.
    const stub = {
      font: '',
      measureText(s: string): TextMetrics {
        return { width: s.length * 7 } as TextMetrics;
      },
    };
    ctx = stub as unknown as CanvasRenderingContext2D;
  }
  measureCtx = ctx;
  return ctx;
}

/** Build a `RenderLayer` that draws text nodes using their `TextPose` and resolved style. */
export function createTextLayer<T>(opts: CreateTextLayerOpts<T>): RenderLayer<unknown> {
  const { id = 'text', label = 'Text', getTexts, getPose, isHidden } = opts;
  return {
    id,
    label,
    draw: (_data, view) => {
      const children: DrawCommand[] = [];
      const mctx = getMeasureCtx();
      for (const node of getTexts()) {
        if (isHidden?.(node)) continue;
        const pose = getPose(node);
        const style = resolveTextStyle(pose.style);
        mctx.font = fontString(style);
        const { lines } = measureText(mctx, pose.text, pose.width, style);
        const lineHeightPx = style.fontSize * style.lineHeight;
        const xAnchor = anchorX(pose.x, pose.width, style);
        for (let i = 0; i < lines.length; i++) {
          children.push({
            kind: 'text',
            x: xAnchor,
            y: pose.y + i * lineHeightPx,
            text: lines[i],
            style: pose.style ?? {},
          });
        }
      }
      return [{ kind: 'group', transform: viewToMat3(view), children }];
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
