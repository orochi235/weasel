/**
 * What the recorder can say about a composite operator: which blend function
 * the composite quad is drawn under, and that the renderer's own is back
 * before anything else draws. `groupEffects.browser.test.ts` has the pixels.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import { makeGLRecorder } from '../testing/glRecorder';
import { WeaselRenderer } from '../WeaselRenderer';
import { _resetProgramRegistryForTests } from '../shaders/registerProgram';
import type { DrawCommand } from '../DrawCommand';
import { cullDrawCommands } from '../cullDrawCommands';
import { leavesUncovered, readsBackdrop } from './compositeOp';

const RECT: DrawCommand = {
  kind: 'path',
  path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
  fill: { paint: { color: '#f00' } },
};

function blendsOf(commands: DrawCommand[]): number[][] {
  const recorder = makeGLRecorder();
  const renderer = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 50, dpr: 1 });
  recorder.reset();
  renderer.render(commands);
  return recorder.calls.filter((c) => c.name === 'blendFunc').map((c) => c.args as number[]);
}

beforeEach(() => { _resetProgramRegistryForTests(); });

describe('a group composite operator', () => {
  const gl = makeGLRecorder().gl;

  it('reads six distinct blend factors off the recorder, so the assertions below can tell them apart', () => {
    const factors = [
      gl.ONE, gl.ZERO, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA,
    ];
    expect(new Set(factors).size).toBe(factors.length);
  });

  it('draws the composite under the operator, then puts source-over back', () => {
    const blends = blendsOf([{ kind: 'group', composite: 'xor', children: [RECT] }, RECT]);
    const xor = blends.findIndex(
      ([s, d]) => s === gl.ONE_MINUS_DST_ALPHA && d === gl.ONE_MINUS_SRC_ALPHA,
    );
    expect(xor).toBeGreaterThanOrEqual(0);
    expect(blends.length - 1).toBeGreaterThan(xor);
    expect(blends[blends.length - 1]).toEqual([gl.ONE, gl.ONE_MINUS_SRC_ALPHA]);
  });

  it('takes a factor pair for an operator it has no name for', () => {
    const blends = blendsOf([{
      kind: 'group',
      composite: { source: 'destination-alpha', destination: 'one' },
      children: [RECT],
    }]);
    expect(blends).toContainEqual([gl.DST_ALPHA, gl.ONE]);
  });

  it('leaves source-over on the plain path, with no buffer', () => {
    const recorder = makeGLRecorder();
    const renderer = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 50, dpr: 1 });
    renderer.render([{ kind: 'group', composite: 'source-over', children: [RECT] }]);
    expect(recorder.calls.map((c) => c.name)).not.toContain('createFramebuffer');
  });

  it('survives the cull when its children all miss: an empty source still changes the destination', () => {
    const off: DrawCommand = { ...RECT, path: { kind: 'rect', x: 900, y: 900, width: 10, height: 10 } };
    const cmds: DrawCommand[] = [{ kind: 'group', composite: 'destination-in', children: [off] }];
    expect(cullDrawCommands(cmds, mat3.identity(), { x: 0, y: 0, width: 100, height: 50 }, 1)).toBe(cmds);
  });
});

describe('leavesUncovered', () => {
  it('holds for the operators that keep the destination where the source is empty', () => {
    const ops = ['source-over', 'source-in', 'source-out', 'source-atop', 'destination-over', 'destination-in',
      'destination-out', 'destination-atop', 'xor', 'lighter', 'copy'] as const;
    expect(ops.filter((op) => leavesUncovered(op))).toEqual(
      ['source-over', 'source-atop', 'destination-over', 'destination-out', 'xor', 'lighter']);
    expect(leavesUncovered({ source: 'one', destination: 'source-alpha' })).toBe(false);
  });
});

describe('readsBackdrop', () => {
  it('finds a composite at any depth and nothing in a plain tree', () => {
    const deep: DrawCommand[] = [RECT, { kind: 'group', children: [{ kind: 'group', composite: 'xor', children: [RECT] }] }];
    expect(readsBackdrop(deep)).toBe(true);
    expect(readsBackdrop([RECT, { kind: 'group', composite: 'source-over', children: [RECT] }])).toBe(false);
  });
});
