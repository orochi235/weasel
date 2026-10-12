import type { Paint } from '@weasel-js/paint';
import {
  meshDrawKind, meshFromStops, meshGradientXml, meshStops, seedMeshPatch, type MeshGradientFill,
} from '@weasel-js/renderer/mesh';
import type { PaintKindEntry } from './paintKindEntry';

// `asPaint`'s cast both ways, kept local: this module must import nothing
// stateful, or `meshKindLazy`'s self-contained copy would duplicate it.
const asMesh = (fill: Paint): MeshGradientFill => fill as unknown as MeshGradientFill;
const asFill = (mesh: MeshGradientFill): Paint => mesh as unknown as Paint;

/** The `mesh-gradient` kind's registry entry. `./registerMesh` registers it;
 *  the paint-kind registry loads it on demand otherwise. */
export const meshGradientKind: PaintKindEntry = {
  ...meshDrawKind,
  label: 'Mesh',
  icon: 'paintMesh',
  seed: (color) => asFill(seedMeshPatch(color)),
  // The first corner of the first patch: a mesh has no single color, and this
  // is the one a fallback swatch and an SVG paint fallback both read.
  colorOf: (paint) => asMesh(paint).patches?.[0]?.colors?.[0],
  stopsOf: (paint) => meshStops(asMesh(paint)),
  fromStops: (stops) => asFill(meshFromStops(stops)),
  toSvg: (id, fill) => meshGradientXml(id, asMesh(fill)),
};
