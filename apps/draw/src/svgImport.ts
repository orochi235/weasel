import { solid } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawPose } from './drawDocument';
import type { Obj } from './svgObj';

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
        fill: o.fill === undefined ? solid('#000000') : o.fill,
        ...(o.stroke ? { stroke: o.stroke } : {}),
        ...(o.style ? { style: o.style } : {}),
        ...(o.runs ? { runs: o.runs } : {}),
        ...(o.verticalAlign ? { verticalAlign: o.verticalAlign } : {}),
      },
    };
  }
  if (o.tool === 'image') return { pose, data: { image: o.image } };
  return { pose, data: { path: o.path, fill: o.fill, stroke: o.stroke } };
}
