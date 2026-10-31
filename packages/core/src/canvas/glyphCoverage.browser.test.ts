/**
 * Small atlas text against real WebGL2 and the real Inter atlas: a stem
 * narrower than a pixel must keep its ink wherever it lands between pixels.
 *
 * Inter's `H` at 7.2px — a 12px superscript — has stems about 0.65px wide,
 * and the atlas is minified about 4.4x. Taking the antialiasing band from
 * `fwidth` of the field let it collapse on exactly this: a 2x2 quad whose two
 * columns straddle the stem sample equal field values, the derivative reads
 * flat, and the stem is thresholded away.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import { createRasterSession, type RasterImage } from './renderSceneToPixels';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';

const FAMILY = 'glyph-coverage-inter';

// One session for every render: a one-shot render builds a renderer and compiles every program, which
// is most of a render's cost and none of what these tests are about.
const session = createRasterSession();

function render(x: number, fontSize: number): RasterImage {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    kind: 'mark', layer: 'main',
    pose: { x, y: 4, width: 40, height: fontSize * 1.2 },
    data: {
      text: 'H',
      style: { fontFamily: FAMILY, fontSize, lineHeight: 1.2 },
      fill: { paint: { kind: 'solid', color: '#ffffff' } },
    },
  });
  return session.render({
    scene,
    sourceRect: { x: 0, y: 0, width: 32, height: 24 },
    scale: { x: 1, y: 1 },
    background: '#000000',
  });
}

/** Ink per column, 0..1 a pixel. */
function columns(img: RasterImage): number[] {
  const cols = new Array<number>(img.width).fill(0);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) cols[x] += img.data[(y * img.width + x) * 4] / 255;
  }
  return cols;
}

/** Intensity-weighted mean column of the ink, in pixels. */
function centroidX(img: RasterImage): number {
  const cols = columns(img);
  let mass = 0, sum = 0;
  cols.forEach((v, x) => { mass += v; sum += v * (x + 0.5); });
  return sum / mass;
}

beforeAll(async () => {
  await registerFont(FAMILY, {}, metricsUrl, atlasUrl);
});
afterAll(() => session.dispose());

describe('atlas glyph coverage at small sizes', () => {
  it('keeps both stems of a 7.2px H at every sub-pixel offset', () => {
    const report: string[] = [];
    let worst = Infinity;
    for (let k = 0; k < 8; k++) {
      const x = 4 + k / 8;
      const cols = columns(render(x, 7.2));
      const inked = cols.map((v, i) => [v, i] as const).filter(([v]) => v > 0.01);
      const first = inked[0][1];
      const last = inked[inked.length - 1][1];
      // Each stem is the first or last two columns of ink; the crossbar joins them.
      const left = cols[first] + cols[first + 1];
      const right = cols[last] + cols[last - 1];
      const ratio = Math.min(left, right) / Math.max(left, right);
      worst = Math.min(worst, ratio);
      report.push(`x ${x.toFixed(3)} left ${left.toFixed(2)} right ${right.toFixed(2)}`);
    }
    // Read at each pixel's center alone, a 0.65px stem centered on a pixel
    // carried about twice the ink of one straddling two (0.5); a stem
    // thresholded away measured 0.21.
    expect(worst, report.join('\n')).toBeGreaterThan(0.7);
  });

  // Read at each pixel's center alone, the offsets swung by 0.88, 0.35 and
  // 0.66px. With area coverage on a quad no wider than its atlas cell, the
  // 7.2px one swung by 0.37: a multisampled target scaled the pixels the
  // quad's edge crossed by the samples it covered (see GLYPH_AREA_MARGIN).
  it.each([[7.2, 0.2], [12, 0.1], [16, 0.1]])('keeps a %spx H\'s ink centroid where it moves to', (size, bound) => {
    // The centroid's offset from x, as x steps through a pixel in eighths.
    const offsets: number[] = [];
    for (let k = 0; k < 8; k++) {
      const x = 4 + k / 8;
      offsets.push(centroidX(render(x, size)) - x);
    }
    const swing = Math.max(...offsets) - Math.min(...offsets);
    expect(swing, offsets.map((o) => o.toFixed(3)).join(' ')).toBeLessThan(bound);
  });

  it('puts down the same ink wherever a 7.2px H lands', () => {
    const masses: number[] = [];
    for (let k = 0; k < 8; k++) {
      masses.push(columns(render(4 + k / 8, 7.2)).reduce((a, b) => a + b, 0));
    }
    const spread = Math.min(...masses) / Math.max(...masses);
    // 0.93 on a quad that clipped its edge pixels' samples, 0.97 on a grown one (teitou).
    expect(spread, masses.map((m) => m.toFixed(2)).join(' ')).toBeGreaterThan(0.95);
  });
});
