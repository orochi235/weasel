import { describe, expect, it } from 'vitest';
import { PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { outlineDetail, outlinePath } from '../outline';

const B = { x: 0, y: 0, width: 96, height: 88 };
const last = (p: PolygonPath | undefined) => p?.commands.at(-1);

describe('circles drawn as two arcs', () => {
  it('close the globe silhouette', () => {
    expect(last(outlinePath('globe', B) as PolygonPath)).toBe(PATH_Z);
  });

  it('close an inclusive gateway ring and a disk spindle', () => {
    expect(last(outlineDetail('inclusiveGateway', B) as PolygonPath)).toBe(PATH_Z);
    expect(last(outlineDetail('server', B) as PolygonPath)).toBe(PATH_Z);
  });
});
