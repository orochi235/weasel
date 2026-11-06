import type { DrawCommand } from '@weasel-js/renderer';
import { mat3, type GlMat3 } from '@weasel-js/renderer';
import type { CommandStroke } from '@weasel-js/paint';
import { resolveStrokeWidth } from '@weasel-js/stroke';
import { PATH_L, PATH_M, type PolygonPath } from '@weasel-js/geom';
import { rotationHandle } from 'interactions/actions/rotate/handle';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { ResolvedHandles } from './handleCommands';

/** GL helper: emit a curved double-headed arrow, the rotate badge above the
 *  rect. The arc opens *toward* the object (apex on top, mouth pointing
 *  down), with an arrowhead at each endpoint pointing along the tangent. */
export function rotationHandleCommands(
  worldB: Bounds,
  handles: ResolvedHandles,
  distance: number,
  view: View,
): DrawCommand[] {
  const hWorld = rotationHandle(worldB, distance, view.scale);
  const rotation = hWorld.angle;
  const t = viewToTransform(view);
  const [scx, scy] = worldToScreen(hWorld.cx, hWorld.cy, t);
  const size = handles.size;
  const arcRadius = size;
  const ARC_HALF_ANGLE = (Math.PI * 240) / 360 / 2; // 120°
  const N_SEGS = 18;
  const arcWidth = resolveStrokeWidth(handles.outline.width ?? 1, 1) * 1.5;
  const stroke: CommandStroke = {
    paint: handles.fill.paint,
    width: arcWidth,
    cap: 'round',
    join: 'round',
  };
  // The arc as a polyline in handle-local coords, centered on the handle
  // anchor: apex at -y, endpoints at +y near the rect side.
  const cmds: number[] = [PATH_M];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= N_SEGS; i++) {
    const t = i / N_SEGS;
    const angle = ARC_HALF_ANGLE - t * ARC_HALF_ANGLE * 2;
    xs.push(arcRadius * Math.sin(angle));
    ys.push(-arcRadius * Math.cos(angle));
    if (i > 0) cmds.push(PATH_L);
  }
  const arcCoords: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    arcCoords.push(xs[i], ys[i]);
  }
  const arcPath: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array(cmds),
    coords: new Float32Array(arcCoords),
    fillRule: 'nonzero',
  };
  // Arrowheads: small filled triangles at each endpoint, pointing along
  // the tangent (away from the arc body).
  const headLen = size * 0.6;
  const headWidth = size * 0.4;
  const arrowHead = (endX: number, endY: number, tx: number, ty: number): PolygonPath => {
    // Normalize tangent.
    const len = Math.hypot(tx, ty) || 1;
    const ux = tx / len;
    const uy = ty / len;
    // Perpendicular (rotate tangent 90° CCW).
    const px = -uy;
    const py = ux;
    // Triangle: tip is endX+ux*headLen, base is endX (with +/- headWidth/2 along p).
    const tipX = endX + ux * headLen;
    const tipY = endY + uy * headLen;
    const baseLeftX = endX + px * (headWidth / 2);
    const baseLeftY = endY + py * (headWidth / 2);
    const baseRightX = endX - px * (headWidth / 2);
    const baseRightY = endY - py * (headWidth / 2);
    return {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L]),
      coords: new Float32Array([tipX, tipY, baseLeftX, baseLeftY, baseRightX, baseRightY, tipX, tipY]),
      fillRule: 'nonzero',
    };
  };
  // Endpoint A (right side, angle = +ARC_HALF_ANGLE). Arc point:
  // (sin(a)·R, -cos(a)·R). Tangent (d/da) = (cos(a)·R, sin(a)·R).
  const angleA = ARC_HALF_ANGLE;
  const endAX = arcRadius * Math.sin(angleA);
  const endAY = -arcRadius * Math.cos(angleA);
  const tangentAX = Math.cos(angleA);
  const tangentAY = Math.sin(angleA);
  // Endpoint B (left side, angle = -ARC_HALF_ANGLE): tangent in the
  // outward direction is the negation of the above.
  const angleB = -ARC_HALF_ANGLE;
  const endBX = arcRadius * Math.sin(angleB);
  const endBY = -arcRadius * Math.cos(angleB);
  const tangentBX = -Math.cos(angleB);
  const tangentBY = -Math.sin(angleB);
  const headA = arrowHead(endAX, endAY, tangentAX, tangentAY);
  const headB = arrowHead(endBX, endBY, tangentBX, tangentBY);
  // Build transform: translate(scx, scy) [* rotate(rotation)].
  let transform = mat3.translated(mat3.identity(), scx, scy);
  if (rotation !== 0) {
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const rot = new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]) as GlMat3;
    transform = mat3.multiply(transform, rot);
  }
  return [
    {
      kind: 'group',
      transform,
      children: [
        { kind: 'path', path: arcPath, stroke },
        { kind: 'path', path: headA, fill: handles.fill },
        { kind: 'path', path: headB, fill: handles.fill },
      ],
    },
  ];
}
