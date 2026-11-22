/**
 * A snap readout's number sits in the middle of its pill. Where text lands is the renderer's
 * layout against a real font atlas, so only a real WebGL2 draw can say.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { WeaselRenderer } from '@weasel-js/renderer';
import metricsUrl from '../../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../../assets/fonts/inter/inter.png?url';
import { pillCommands } from './readoutDraw';

const W = 96;
const H = 48;
const CX = 48;
const CY = 24;

let renderer: WeaselRenderer | undefined;

beforeAll(async () => {
  await registerFont('sans-serif', { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
});

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** The center of the box around the white ink a pill's label draws, in canvas px with y down: equal
 *  margins either side, which is what reads as centered. */
function inkCenter(label: string): { x: number; y: number } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderer.render(pillCommands(CX, CY, label, '#ff00ff'));
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  // The pill is magenta, so green is the label's ink alone; a column or row's edge counts its
  // coverage as a fraction of a pixel.
  const cols = new Float64Array(W);
  const rows = new Float64Array(H);
  for (let row = 0; row < H; row++) {
    for (let x = 0; x < W; x++) {
      const g = px[(row * W + x) * 4 + 1]! / 255;
      cols[x] = Math.max(cols[x]!, g);
      rows[H - 1 - row] = Math.max(rows[H - 1 - row]!, g);
    }
  }
  return { x: middle(cols), y: middle(rows) };
}

/** The midpoint of a line's inked span, its first and last pixels counted by their coverage. */
function middle(line: Float64Array): number {
  const first = line.findIndex((v) => v > 0);
  let last = line.length - 1;
  while (last > 0 && !(line[last]! > 0)) last--;
  return (first + 1 - line[first]! + last + line[last]!) / 2;
}

describe('a readout pill', () => {
  for (const label of ['8', '24', '128', '1024']) {
    it(`centers "${label}" in the pill`, () => {
      const c = inkCenter(label);
      expect(Math.abs(c.x - CX)).toBeLessThan(0.5);
      expect(Math.abs(c.y - CY)).toBeLessThan(0.5);
    });
  }
});
