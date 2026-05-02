import { describe, expect, it } from 'vitest';
import { traceToContext } from './canvas';
import { PathBuilder, rectPath } from './builder';

function makeStubCtx() {
  const calls: string[] = [];
  const record = (name: string) => (...args: number[]) => calls.push(`${name}(${args.join(',')})`);
  const ctx = {
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    bezierCurveTo: record('bezierCurveTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    closePath: record('closePath'),
    rect: record('rect'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('traceToContext', () => {
  it('emits a single rect() for RectPath', () => {
    const { ctx, calls } = makeStubCtx();
    traceToContext(ctx, rectPath(1, 2, 3, 4));
    expect(calls).toEqual(['beginPath()', 'rect(1,2,3,4)']);
  });

  it('walks the polygon command stream verbatim', () => {
    const { ctx, calls } = makeStubCtx();
    const p = new PathBuilder()
      .moveTo(0, 0)
      .lineTo(10, 0)
      .quadTo(15, 5, 10, 10)
      .curveTo(5, 15, -5, 5, 0, 0)
      .close()
      .build();
    traceToContext(ctx, p);
    expect(calls).toEqual([
      'beginPath()',
      'moveTo(0,0)',
      'lineTo(10,0)',
      'quadraticCurveTo(15,5,10,10)',
      'bezierCurveTo(5,15,-5,5,0,0)',
      'closePath()',
    ]);
  });
});
