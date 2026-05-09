import type { RenderLayer } from '../../../core/layers/render';
import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from '../../../features/paths/types';
import { enumerateAnchors } from './geometry';
import type { DrawCommand } from '@orochi235/weasel-gl';

const CIRCLE_SEGMENTS = 12;

function circlePath(cx: number, cy: number, r: number): PolygonPath {
  const n = CIRCLE_SEGMENTS;
  const commands = new Uint8Array(n + 2); // M + n*L + Z
  const coords = new Float32Array(2 * (n + 1));
  commands[0] = PATH_M;
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    coords[i * 2] = cx + Math.cos(theta) * r;
    coords[i * 2 + 1] = cy + Math.sin(theta) * r;
    commands[i] = i === 0 ? PATH_M : PATH_L;
  }
  commands[n] = PATH_L;
  coords[n * 2] = cx + r;
  coords[n * 2 + 1] = cy;
  commands[n + 1] = PATH_Z;
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

/** Visual options for the anchor-edit overlay. */
export interface AnchorEditOverlayOpts {
  /** Returns the live editing state (or `null` when not editing). The overlay
   *  draws nothing when `null`. */
  getOverlay: () => {
    pose: PolygonPath;
    selectedAnchors: number[];
  } | null;
  /** Tangent-line stroke color. Default `#888`. */
  tangentStroke?: string;
  /** Anchor circle radius (world units). Default 4. */
  anchorRadius?: number;
  /** Control circle radius (world units). Default 3. */
  controlRadius?: number;
  /** Anchor fill. Default `#fff`. */
  anchorFill?: string;
  /** Anchor stroke. Default `#1a130d`. */
  anchorStroke?: string;
  /** Selected-anchor fill (highlight). Default `#7fb069`. */
  selectedAnchorFill?: string;
  /** Control fill. Default `#1a130d`. */
  controlFill?: string;
  /** Control stroke. Default `#fff`. */
  controlStroke?: string;
}

export function createAnchorEditOverlayLayer(opts: AnchorEditOverlayOpts): RenderLayer<unknown> {
  const tangentStroke = opts.tangentStroke ?? '#888';
  const anchorRadius = opts.anchorRadius ?? 4;
  const controlRadius = opts.controlRadius ?? 3;
  const anchorFill = opts.anchorFill ?? '#fff';
  const anchorStroke = opts.anchorStroke ?? '#1a130d';
  const selectedAnchorFill = opts.selectedAnchorFill ?? '#7fb069';
  const controlFill = opts.controlFill ?? '#1a130d';
  const controlStroke = opts.controlStroke ?? '#fff';
  return {
    id: 'anchor-edit-overlay',
    label: 'Anchor edit',
    draw: (ctx) => {
      const ov = opts.getOverlay();
      if (!ov) return;
      const anchors = enumerateAnchors(ov.pose);
      const selected = new Set(ov.selectedAnchors);
      ctx.save();
      // Tangent lines: anchor → controlIn / anchor → controlOut.
      ctx.strokeStyle = tangentStroke;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const a of anchors) {
        if (a.controlIn) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.controlIn.x, a.controlIn.y);
        }
        if (a.controlOut) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.controlOut.x, a.controlOut.y);
        }
      }
      ctx.stroke();
      // Control handles (smaller, drawn first so anchors render on top).
      ctx.lineWidth = 1;
      for (const a of anchors) {
        for (const c of [a.controlIn, a.controlOut]) {
          if (!c) continue;
          ctx.beginPath();
          ctx.arc(c.x, c.y, controlRadius, 0, Math.PI * 2);
          ctx.fillStyle = controlFill;
          ctx.fill();
          ctx.strokeStyle = controlStroke;
          ctx.stroke();
        }
      }
      // Anchors.
      for (const a of anchors) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, anchorRadius, 0, Math.PI * 2);
        ctx.fillStyle = selected.has(a.anchorIndex) ? selectedAnchorFill : anchorFill;
        ctx.fill();
        ctx.strokeStyle = anchorStroke;
        ctx.stroke();
      }
      ctx.restore();
    },
    drawGL: () => {
      const ov = opts.getOverlay();
      if (!ov) return [];
      const anchors = enumerateAnchors(ov.pose);
      const selected = new Set(ov.selectedAnchors);
      const out: DrawCommand[] = [];
      // Tangent lines: anchor → controlIn / anchor → controlOut, each as a 2-point polygon.
      for (const a of anchors) {
        for (const c of [a.controlIn, a.controlOut]) {
          if (!c) continue;
          const commands = new Uint8Array([PATH_M, PATH_L]);
          const coords = new Float32Array([a.x, a.y, c.x, c.y]);
          out.push({
            kind: 'path',
            path: { kind: 'polygon', commands, coords, fillRule: 'nonzero' },
            stroke: { paint: { color: tangentStroke }, width: 1 },
          });
        }
      }
      // Control handles (smaller, drawn first so anchors render on top).
      for (const a of anchors) {
        for (const c of [a.controlIn, a.controlOut]) {
          if (!c) continue;
          out.push({
            kind: 'path',
            path: circlePath(c.x, c.y, controlRadius),
            fill: { color: controlFill },
            stroke: { paint: { color: controlStroke }, width: 1 },
          });
        }
      }
      // Anchors.
      for (const a of anchors) {
        out.push({
          kind: 'path',
          path: circlePath(a.x, a.y, anchorRadius),
          fill: { color: selected.has(a.anchorIndex) ? selectedAnchorFill : anchorFill },
          stroke: { paint: { color: anchorStroke }, width: 1 },
        });
      }
      return out;
    },
  };
}
