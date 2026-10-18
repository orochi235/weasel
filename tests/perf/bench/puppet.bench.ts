/**
 * Puppet warp: what a pin set costs to set up (mesh the fill, factor the
 * as-rigid-as-possible systems) against what each drag frame costs once it is
 * set up (re-solve for the moved pins, then carry the path through the mesh
 * and refit it). A drag pays only the frame; adding or removing a pin pays the
 * setup once.
 */
import { group } from './group';
import { PathBuilder, type PolygonPath } from '@weasel-js/geom';
import { applyPathWarp, createArapSolver, puppetMesh, type PuppetPin } from '@weasel-js/geom/warp';

/** A twelve-pointed star of cubic edges, 360 units across. */
function star(): PolygonPath {
  const b = new PathBuilder();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 ? 60 : 180;
    const x = 200 + r * Math.cos(a), y = 200 + r * Math.sin(a);
    if (i === 0) b.moveTo(x, y);
    else b.curveTo(x - 10, y - 10, x + 10, y + 10, x, y);
  }
  return b.close().build();
}

const shape = star();
const at = [{ x: 200, y: 200 }, { x: 380, y: 200 }, { x: 200, y: 380 }, { x: 60, y: 200 }];
const pinsAt = (k: number): PuppetPin[] => at.map((p, i) => ({ from: p, to: i === 1 ? { x: p.x + k, y: p.y - k } : p }));

group('puppet warp — setup per pin set', (bench) => {
  for (const vertices of [200, 400, 800]) {
    bench(`mesh + factor, ~${vertices} vertices`, () => {
      const mesh = puppetMesh(shape, at, { vertices });
      createArapSolver(mesh, Array.from(mesh.pinVertex));
    });
  }
});

group('puppet warp — per drag frame', (bench) => {
  for (const vertices of [200, 400, 800]) {
    const mesh = puppetMesh(shape, at, { vertices });
    const solver = createArapSolver(mesh, Array.from(mesh.pinVertex));
    let k = 0;
    bench(`solve, ${mesh.vertices.length / 2} vertices`, () => {
      k = (k + 1) % 40;
      solver.solve([200, 200, 380 + k, 200 - k, 200, 380, 60, 200]);
    });
    bench(`solve, ${mesh.vertices.length / 2} vertices, the two linear steps alone`, () => {
      k = (k + 1) % 40;
      solver.solve([200, 200, 380 + k, 200 - k, 200, 380, 60, 200], { iterations: 0, injectiveIterations: 0 });
    });
  }
  let k = 0;
  bench('solve + map + refit the star (default mesh)', () => {
    k = (k + 1) % 40;
    applyPathWarp(shape, { kind: 'puppet', pins: pinsAt(k) });
  });
});
