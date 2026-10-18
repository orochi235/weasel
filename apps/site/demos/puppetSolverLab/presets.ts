/**
 * The pin sets the lab opens on: two the two-step solve folds, and one it
 * handles. Each is written in its own units and placed on the canvas by a
 * uniform scale, which changes nothing about how it deforms: the mesh is
 * spaced relative to the shape's size and the solve is linear in position.
 */
import { PathBuilder, transformPath, type Point, type PolygonPath } from '@weasel-js/geom';
import type { PuppetPin } from '@weasel-js/geom/warp';

export type PresetId = 'disc' | 'bar-s' | 'bend';

export interface Preset {
  label: string;
  shape: PolygonPath;
  pins: PuppetPin[];
  /** What to look at and what to try, under the readout. */
  caption: string;
}

const K = 0.5522847498;

/** A disc 100 across, centered on (50, 50), as four cubics. */
function disc(): PolygonPath {
  const c = 50, r = 50, k = K * r;
  return new PathBuilder()
    .moveTo(c + r, c)
    .curveTo(c + r, c + k, c + k, c + r, c, c + r)
    .curveTo(c - k, c + r, c - r, c + k, c - r, c)
    .curveTo(c - r, c - k, c - k, c - r, c, c - r)
    .curveTo(c + k, c - r, c + r, c - k, c + r, c)
    .close().build();
}

const bar = () => new PathBuilder().moveTo(0, 0).lineTo(200, 0).lineTo(200, 20).lineTo(0, 20).close().build();

const hold = (x: number, y: number): PuppetPin => ({ from: { x, y }, to: { x, y } });
const drag = (x: number, y: number, tx: number, ty: number): PuppetPin => ({ from: { x, y }, to: { x: tx, y: ty } });

function placed(shape: PolygonPath, pins: PuppetPin[], scale: number, dx: number, dy: number) {
  const at = (p: Point) => ({ x: scale * p.x + dx, y: scale * p.y + dy });
  return {
    shape: transformPath(shape, [scale, 0, 0, scale, dx, dy]) as PolygonPath,
    pins: pins.map((p) => ({ from: at(p.from), to: at(p.to) })),
  };
}

export const PRESETS: Record<PresetId, Preset> = {
  disc: {
    label: 'Disc',
    ...placed(disc(), [hold(20, 50), drag(80, 50, 60, 70), drag(50, 20, 40, 30)], 2.6, 30, 30),
    caption: 'The left pin holds and the other two are pushed toward it. At step 2 one triangle on the left edge has turned over, '
      + 'so its stretch of outline, drawn heavy, runs backward. The local/global rounds move the fold about without '
      + 'clearing it, and the untangling pass rights it in its first round.',
  },
  'bar-s': {
    label: 'S bar',
    ...placed(bar(), [drag(10, 10, 50, 10), drag(70, 10, 60, -40), drag(130, 10, 140, 60), drag(190, 10, 150, 10)], 1.35, 30, 110),
    caption: 'The ends are pushed together and the two middle pins pulled opposite ways. Step 2 turns three triangles over at '
      + 'those pins, and the local/global rounds make it six. The untangling pass turns more over at first, then '
      + 'works them all back and ends with none.',
  },
  bend: {
    label: 'Bend',
    ...placed(bar(), [hold(10, 10), hold(190, 10), drag(100, 10, 100, -20)], 1.35, 30, 120),
    caption: 'Both ends hold and the middle is lifted. No step turns a triangle over, so the solve ends after the '
      + 'local/global rounds with no untangling pass. Drag the middle pin much higher to find where step 2 starts to fold.',
  },
};
