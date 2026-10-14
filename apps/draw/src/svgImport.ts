import { solid, type ShapeGenerator } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawPose } from './drawDocument';
import type { Obj, PathObj } from './svgObj';

/** The generator a polygon or star `Obj`'s `params` name. Params without a
 *  rotation cannot place the shape again, so they import as plain geometry. */
function generatorOfObj(o: PathObj): ShapeGenerator | null {
  const p = o.params;
  if (!p || p.rotation === undefined) return null;
  if (o.tool === 'polygon' && 'sides' in p) return { kind: 'polygon', sides: p.sides, rotation: p.rotation };
  if (o.tool === 'star' && 'points' in p) {
    return { kind: 'star', points: p.points, innerRadiusRatio: p.ratio, rotation: p.rotation };
  }
  return null;
}

/** The scene leaf an imported `Obj` becomes: its box as the pose, and the
 *  `data` the kit painters read. */
export function leafOfObj(o: Obj): { pose: WeaselDrawPose; data: WeaselDrawData } {
  const pose: WeaselDrawPose = { x: o.x, y: o.y, width: o.width, height: o.height };
  if (o.rotation) pose.rotation = o.rotation;
  if (o.tool === 'text') {
    return {
      pose,
      data: {
        text: o.text,
        fill: o.fill === undefined ? { paint: solid('#000000') } : o.fill,
        ...(o.stroke ? { stroke: o.stroke } : {}),
        ...(o.style ? { style: o.style } : {}),
        ...(o.runs ? { runs: o.runs } : {}),
        ...(o.verticalAlign ? { verticalAlign: o.verticalAlign } : {}),
      },
    };
  }
  if (o.tool === 'image') return { pose, data: { image: o.image } };
  const generator = generatorOfObj(o);
  return { pose, data: { path: o.path, fill: o.fill, stroke: o.stroke, ...(generator ? { generator } : {}) } };
}
