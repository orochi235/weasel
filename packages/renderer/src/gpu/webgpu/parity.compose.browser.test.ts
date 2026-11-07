/**
 * WebGL and WebGPU in one page, for how a draw joins what is beneath it:
 * every composite operator a group offers, over a translucent backdrop, and
 * stencil clips nested inside each other and around even-odd fills. Each case
 * logs its line of the parity table.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import type { DrawCommand } from '../../DrawCommand';
import type { CompositeOp } from '../../effects/compositeOp';
import { closeBackends, openBackends, parityDevice, releaseDevice, renderBoth, report, requireGpu } from '@weasel-js/renderer/testing/parityHarness';

const W = 64;
const H = 48;

const rect = (x: number, y: number, w: number, h: number, color: string): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width: w, height: h }, fill: { paint: { color } },
});

/** Opaque on the left, translucent in the middle, empty on the right: every operator reads all three. */
const BACKDROP: DrawCommand[] = [rect(0, 0, 22, H, '#d04020'), rect(22, 0, 22, H, 'rgba(30, 90, 200, 0.5)')];

const evenOdd = (d: string): PolygonPath => ({ ...pathFromD(d), fillRule: 'evenodd' } as PolygonPath);

afterAll(() => releaseDevice());
beforeAll(async () => {
  await parityDevice();
});
beforeEach(requireGpu);
afterEach(() => closeBackends());

async function expectParity(name: string, commands: DrawCommand[], dpr = 1): Promise<void> {
  const b = await openBackends({ width: W, height: H, dpr });
  const d = await renderBoth(b, commands);
  const line = report(name, d);
  expect(d.over, line).toBe(0);
}

const OPERATORS: CompositeOp[] = [
  'source-over', 'source-in', 'source-out', 'source-atop', 'destination-over', 'destination-in',
  'destination-out', 'destination-atop', 'xor', 'lighter', 'copy',
];

describe('WebGL and WebGPU composite and clip the same', () => {
  it.each(OPERATORS)('a group composited %s over a translucent backdrop', async (composite) => {
    await expectParity(`composite ${composite}`, [...BACKDROP, {
      kind: 'group', composite, alpha: 0.8,
      children: [rect(8, 8, 48, 18, '#30c060'), rect(12, 22, 44, 18, 'rgba(240, 200, 40, 0.6)')],
    }]);
  });

  it('a group composited by explicit factors', async () => {
    await expectParity('composite factors dst-alpha/one', [...BACKDROP, {
      kind: 'group', composite: { source: 'destination-alpha', destination: 'one' },
      children: [rect(6, 6, 52, 36, 'rgba(120, 40, 200, 0.7)')],
    }]);
  });

  it('three curved clips nested', async () => {
    await expectParity('three nested curved clips', [rect(0, 0, W, H, '#f4efe6'), {
      kind: 'group', clip: pathFromD('M32 1 A23 23 0 1 1 31.99 1 Z'),
      children: [rect(0, 0, W, H, '#e07020'), {
        kind: 'group', clip: pathFromD('M0 30 C 20 0, 44 60, 64 20 L 64 48 L 0 48 Z'),
        children: [rect(0, 0, W, H, '#2060c0'), {
          kind: 'group', clip: pathFromD('M10 10 Q 32 60 54 10 Q 32 30 10 10 Z'),
          children: [rect(0, 0, W, H, 'rgba(255, 255, 255, 0.7)')],
        }],
      }],
    }], 2);
  });

  it('an even-odd clip with an even-odd fill inside it', async () => {
    await expectParity('even-odd clip around an even-odd fill', [rect(0, 0, W, H, '#f4efe6'), {
      kind: 'group', clip: evenOdd('M2 2 L62 2 L62 46 L2 46 Z M14 10 L50 10 L50 38 L14 38 Z'),
      children: [
        rect(0, 0, W, H, '#406080'),
        { kind: 'path', path: evenOdd('M6 6 Q 32 -10 58 6 L58 42 L6 42 Z M20 16 L44 16 L44 32 L20 32 Z'), fill: { paint: { color: 'rgba(220, 60, 120, 0.8)' } } },
      ],
    }], 2);
  });

  it('a clip under a group composited destination-out', async () => {
    await expectParity('clip around destination-out', [...BACKDROP, {
      kind: 'group', clip: pathFromD('M32 4 A20 20 0 1 1 31.99 4 Z'),
      children: [{ kind: 'group', composite: 'destination-out', children: [rect(10, 10, 44, 28, 'rgba(0, 0, 0, 0.6)')] }],
    }]);
  });
});
