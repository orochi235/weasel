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
import { describe, it, expect, beforeAll } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import { renderSceneToPixels, type RasterImage } from '../canvas/renderSceneToPixels';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';

const FAMILY = 'glyph-coverage-inter';

function render(x: number, fontSize: number): RasterImage {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    kind: 'leaf', layer: 'main',
    pose: { x, y: 4, width: 40, height: fontSize * 1.2 },
    data: {
      text: 'H',
      style: { fontFamily: FAMILY, fontSize, lineHeight: 1.2 },
      fill: { fill: 'solid', color: '#ffffff' },
    },
  });
  return renderSceneToPixels({
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

beforeAll(async () => {
  await registerFont(FAMILY, {}, metricsUrl, atlasUrl);
});

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
    // Coverage is read from the distance at each pixel's center, so a 0.65px
    // stem centered on a pixel carries about twice the ink of one straddling
    // two: 0.5 is the floor that sampling allows. A stem thresholded away
    // measured 0.21.
    expect(worst, report.join('\n')).toBeGreaterThan(0.45);
  });

  it('puts down the same ink wherever a 7.2px H lands', () => {
    const masses: number[] = [];
    for (let k = 0; k < 8; k++) {
      masses.push(columns(render(4 + k / 8, 7.2)).reduce((a, b) => a + b, 0));
    }
    const spread = Math.min(...masses) / Math.max(...masses);
    expect(spread, masses.map((m) => m.toFixed(2)).join(' ')).toBeGreaterThan(0.8);
  });
});
