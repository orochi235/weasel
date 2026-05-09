import earcut from 'earcut';
import {
  type Path,
  type PolygonPath,
  type RectPath,
  PATH_M,
  PATH_L,
  PATH_Z,
  PATH_C,
  PATH_Q,
  PATH_CMD_LENGTHS,
} from '@orochi235/weasel';
import type { Mesh } from './mesh';

export function tessellate(path: Path): Mesh {
  if (path.kind === 'rect') return tessellateRect(path);
  return tessellatePolygon(path);
}

function tessellateRect(p: RectPath): Mesh {
  const { x, y, width: w, height: h } = p;
  return {
    vertices: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

interface FlattenedContours {
  /** Interleaved x,y for all contours concatenated. */
  coords: number[];
  /** Vertex indices where each contour after the first begins. earcut's hole format. */
  holeStarts: number[];
}

function flattenPolygon(p: PolygonPath): FlattenedContours {
  const { commands, coords } = p;
  const out: number[] = [];
  const holeStarts: number[] = [];
  let coordIdx = 0;

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        if (out.length > 0) holeStarts.push(out.length / 2);
        out.push(coords[coordIdx], coords[coordIdx + 1]);
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        out.push(coords[coordIdx], coords[coordIdx + 1]);
        coordIdx += 2;
        break;
      }
      case PATH_Q:
      case PATH_C: {
        coordIdx += PATH_CMD_LENGTHS[cmd];
        throw new Error('tessellate: bezier curves not yet supported (added in later task)');
      }
      case PATH_Z: {
        break;
      }
      default:
        throw new Error(`tessellate: unknown command code ${cmd}`);
    }
  }

  return { coords: out, holeStarts };
}

function tessellatePolygon(p: PolygonPath): Mesh {
  const { coords, holeStarts } = flattenPolygon(p);
  const indices = earcut(coords, holeStarts.length > 0 ? holeStarts : undefined);
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
  };
}
