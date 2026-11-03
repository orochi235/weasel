import { describe, expect, it } from 'vitest';
import { INITIAL_NODES, MODULE, outputGrid, snapMarks } from '../ditherDemoScene';

const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;

describe('snapMarks', () => {
  for (const dpi of [180, 300]) {
    it(`puts every bar on whole modules and every rule on whole dots at ${dpi} dpi`, () => {
      const grid = outputGrid(dpi);
      const poses = snapMarks(INITIAL_NODES, grid);
      const perModule = Math.max(1, Math.round(MODULE / grid.pitch));
      for (const n of INITIAL_NODES) {
        if (!n.data.mark) {
          expect(poses.has(n.id)).toBe(false);
          continue;
        }
        const p = poses.get(n.id)!;
        for (const v of [p.x, p.x + p.width, p.y, p.y + p.height]) expect(whole(v / grid.pitch)).toBe(true);
        expect(Math.round(p.height / grid.pitch)).toBeGreaterThanOrEqual(1);
        if (n.data.mark === 'bar') {
          expect(Math.round(p.width / grid.pitch)).toBe(Math.round(n.pose.width / MODULE) * perModule);
        }
      }
    });
  }

  it('leaves the document alone', () => {
    const before = JSON.stringify(INITIAL_NODES);
    snapMarks(INITIAL_NODES, outputGrid(180));
    expect(JSON.stringify(INITIAL_NODES)).toBe(before);
  });
});
