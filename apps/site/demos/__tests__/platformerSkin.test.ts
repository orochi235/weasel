// apps/site/demos/__tests__/platformerSkin.test.ts
import { describe, it, expect } from 'vitest';
import type { View } from '@weasel-js/core';
import { BANDS, backdropBand, drawEnding, drawSky } from '../platformer/skin';

const DIMS = { width: 640, height: 360 };

type Cmd = { kind: string; transform?: Float32Array; children?: Cmd[]; path?: Path };
type Path = { kind: string; x: number; y: number; width: number; height: number; coords: Float32Array };

/** Every path a band drew, in the band's own world units: each tiled copy is
 *  a group translated by its lattice offset. */
function paths(cmds: Cmd[], dx = 0): { path: Path; dx: number }[] {
  return cmds.flatMap((c) => c.kind === 'group'
    ? paths(c.children ?? [], dx + (c.transform?.[6] ?? 0))
    : c.path ? [{ path: c.path, dx }] : []);
}

// Two camera positions on either side of the origin, neither on a lattice line.
const VIEWS: View[] = [
  { x: 137.5, y: 40, scale: { x: 2, y: 2 } },
  { x: -913.25, y: -12, scale: { x: 2, y: 2 } },
];

describe('backdrop', () => {
  it('fills the whole viewport with sky', () => {
    const [sky] = drawSky(DIMS) as Cmd[];
    expect(sky.path).toMatchObject({ kind: 'rect', x: 0, y: 0, width: DIMS.width, height: DIMS.height });
  });

  for (const band of ['far', 'mid', 'near'] as const) {
    const { period, height, baseline } = BANDS[band];
    for (const view of VIEWS) {
      const spanX = DIMS.width / view.scale.x;
      const bottom = view.y + DIMS.height / view.scale.y;
      const drawn = paths(backdropBand(band).draw(null, view, DIMS) as Cmd[]);

      it(`${band} at x=${view.x}: ground spans the view with no gap`, () => {
        const ground = drawn
          .filter(({ path }) => path.kind === 'rect')
          .map(({ path, dx }) => {
            expect(path.y).toBe(baseline);
            expect(path.y + path.height).toBeGreaterThanOrEqual(bottom);
            return [path.x + dx, path.x + path.width + dx] as const;
          })
          .sort((a, b) => a[0] - b[0]);
        let reach = ground[0][0];
        expect(reach).toBeLessThanOrEqual(view.x);
        for (const [from, to] of ground) {
          expect(from).toBeLessThanOrEqual(reach);
          reach = Math.max(reach, to);
        }
        expect(reach).toBeGreaterThanOrEqual(view.x + spanX);
      });

      it(`${band} at x=${view.x}: a hill peaks at every period the view can see`, () => {
        const peaks = drawn
          .filter(({ path }) => path.kind === 'polygon')
          .map(({ path, dx }) => {
            let top = 0;
            for (let i = 1; i < path.coords.length; i += 2) if (path.coords[i] < path.coords[top + 1]) top = i - 1;
            expect(path.coords[top + 1]).toBe(baseline - height);
            return path.coords[top] + dx;
          });
        const want: number[] = [];
        for (let k = Math.floor(view.x / period) - 1; k * period - period / 2 < view.x + spanX; k++) {
          if (k * period + period / 2 > view.x) want.push(k * period);
        }
        for (const x of want) expect(peaks, `peak at ${x}`).toContainEqual(x);
      });
    }
  }
});

describe('drawEnding', () => {
  it('ramps the ground in before the lettering', () => {
    const early = drawEnding('lost', 0.15, DIMS) as never[];
    const [ground, text] = early as unknown as { alpha: number }[];
    expect(ground.alpha).toBeGreaterThan(0);
    // The text ramp starts later, so at 0.15s it is still fully transparent.
    expect(text.alpha).toBe(0);
  });

  it('settles both ramps and stays settled', () => {
    const [ground, text] = drawEnding('lost', 5, DIMS) as unknown as { alpha: number }[];
    expect(ground.alpha).toBeCloseTo(0.78, 5);
    expect(text.alpha).toBe(1);
  });

  it('says YOU DIED on a loss and something else on a win', () => {
    const read = (o: 'won' | 'lost') => {
      const [, group] = drawEnding(o, 5, DIMS) as unknown as { children: { runs: { text: string }[] }[] }[];
      return group.children[0].runs[0].text;
    };
    expect(read('lost')).toBe('YOU DIED');
    expect(read('won')).not.toBe('YOU DIED');
  });

  it('centres the lettering in the viewport with tracking', () => {
    const [, group] = drawEnding('lost', 5, DIMS) as unknown as {
      children: { x: number; height: number; verticalAlign: string; style: { letterSpacing?: number } }[];
    }[];
    const cmd = group.children[0];
    expect(cmd.x).toBe(DIMS.width / 2);
    expect(cmd.height).toBe(DIMS.height);
    expect(cmd.verticalAlign).toBe('center');
    expect(cmd.style.letterSpacing).toBeGreaterThan(0);
  });
});
