import type { BaseModule } from './types';
import { polygonSampler } from './polygonSampler';

export interface PolygonParams {
  /** Vertices in viewBox 0..100 coordinates, traced clockwise. */
  vertices?: [number, number][];
}

const DEFAULT_VERTS: [number, number][] = [
  [0, 0], [100, 0], [100, 100], [0, 100],
];

const Polygon: BaseModule<PolygonParams> = {
  build: (params, boxW, boxH) => {
    const verts = (params?.vertices && params.vertices.length >= 3) ? params.vertices : DEFAULT_VERTS;
    return polygonSampler(verts, boxW, boxH);
  },
  defaults: { vertices: DEFAULT_VERTS },
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
};

export default Polygon;
