/**
 * `.lbx` objects carried through a scene's draw commands: how a node the writer would otherwise see
 * as paint (a barcode's bars) reaches the file as the object it is.
 */
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { LabelObject } from 'bil-lbx';
import { axisMap, type AxisMap, type DrawState } from './style';

const CARRIED = Symbol('weasel.lbxObjects');

type Carrier = GroupDrawCommand & { [CARRIED]: readonly LabelObject[] };

/**
 * A command that draws nothing and puts `objects` in the `.lbx` file where it stands, in its paint
 * order. Positions (and a line's points) are in the frame the command is drawn in, and the writer
 * carries them through the transforms above it; sizes inside an object, such as a font size or a
 * barcode's bar width, are written as given. Return it from the `drawOne` passed to `sceneToLbx` for
 * a node whose object the draw commands cannot say, as a barcode's bars do not say it is a barcode.
 */
export function lbxObjects(objects: readonly LabelObject[]): DrawCommand {
  const carrier: Carrier = { kind: 'group', children: [], [CARRIED]: objects };
  return carrier;
}

/** The objects `cmd` carries, or undefined when it is an ordinary command. */
export function carriedObjects(cmd: DrawCommand): readonly LabelObject[] | undefined {
  return (cmd as Partial<Carrier>)[CARRIED];
}

function placeObject(obj: LabelObject, map: AxisMap): LabelObject {
  const { x, y, width, height } = obj.position;
  const position = { ...obj.position, x: x * map.sx + map.tx, y: y * map.sy + map.ty, width: width * map.sx, height: height * map.sy };
  if (obj.type !== 'line') return { ...obj, position };
  const points = obj.points.map((p) => ({ x: p.x * map.sx + map.tx, y: p.y * map.sy + map.ty }));
  return { ...obj, position, points };
}

/** `objects` in the page's frame under `state`, or undefined under a rotation, skew or mirror. */
export function placeCarried(objects: readonly LabelObject[], state: DrawState): LabelObject[] | undefined {
  const map = axisMap(state.transform);
  return map && objects.map((obj) => placeObject(obj, map));
}
