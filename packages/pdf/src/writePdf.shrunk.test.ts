import { mat3, PATH_L, PATH_M, PATH_Q, type Path } from '@weasel-js/geom';
import { type DrawCommand, registerTexture, unregisterTexture } from '@weasel-js/renderer';
import { describe, expect, it } from 'vitest';
import { latin1 } from './latin1';
import { NO_FONTS } from './testing/noFonts';
import { writePdf } from './writePdf';

async function render(commands: DrawCommand[], readPixels?: () => { width: number; height: number; data: Uint8ClampedArray }) {
  const { bytes, skipped } = await writePdf([{ width: 100, height: 100, commands }], { fonts: NO_FONTS, compress: false, readPixels });
  return { s: latin1(bytes), skipped };
}

const line: Path = { kind: 'polygon', commands: Uint8Array.from([PATH_M, PATH_L]), coords: Float32Array.from([0, 0, 0.001, 0]), fillRule: 'nonzero' };

// Shrunk from the writer's property tests (2026-11-10).
describe('writePdf, shrunk counterexamples', () => {
  it('writes a miter limit below 1 as 1, which PDF accepts and which bevels as the renderer does', async () => {
    const { s } = await render([{ kind: 'path', path: line, stroke: { paint: { color: '#000' }, width: 1, miterLimit: 0 } }]);
    expect(s).toContain('\n1 M\n');
  });

  it('strokes solid a dash every length of which rounds to 0, rather than writing an all-zero one', async () => {
    const { s } = await render([{ kind: 'path', path: line, stroke: { paint: { color: '#000' }, width: 1, dash: [1e-6] } }]);
    expect(s).not.toMatch(/ d\n/);
    expect(s).toContain('\nS\n');
  });

  it('drops and reports a path with an infinite coordinate that an outer stroke would outline, rather than throwing', async () => {
    const path: Path = {
      kind: 'polygon', commands: Uint8Array.from([PATH_M, PATH_Q, PATH_L]), coords: Float32Array.from([0, Infinity, 0, 0, 0, 1, 0, 0]),
      fillRule: 'nonzero', openFill: 'none',
    };
    const { skipped } = await render([{ kind: 'path', path, stroke: { paint: { color: '#000' }, width: 5e-324, align: 'outer' } }]);
    expect(skipped).toEqual([{ kind: 'command', detail: 'path has a non-finite coordinate' }]);
  });

  it('writes a group scaled far down as the scale it is, not a singular matrix', async () => {
    const s = 1e-5;
    const { s: file } = await render([{
      kind: 'group',
      transform: mat3.fromAffine([s, 0, 0, s, 10, 10]),
      children: [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 50 / s, height: 50 / s }, fill: { paint: { color: '#f00' } } }],
    }]);
    expect(file).toContain('\n0.00001 0 0 0.00001 10 10 cm\n');
  });

  it('writes a texture tile of 1e-7 with no exponent and a matrix that keeps it', async () => {
    const texture = registerTexture({ width: 1, height: 1 } as unknown as ImageBitmap);
    try {
      const { s, skipped } = await render(
        [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: { kind: 'texture', texture, width: 1e-7, height: 1e-7 } as never } }],
        () => ({ width: 1, height: 1, data: Uint8ClampedArray.of(0, 0, 0, 255) }),
      );
      expect(skipped).toEqual([]);
      expect(s).not.toMatch(/\de-\d/);
      expect(s).toContain('/Matrix [0.0000001 0 0 -0.0000001 0 100]');
    } finally {
      unregisterTexture(texture);
    }
  });
});
