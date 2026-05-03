// src/tools/defineTool.test.ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import { defineTool } from './defineTool';

describe('defineTool', () => {
  it('returns the spec unchanged at runtime', () => {
    const spec = { id: 'foo' as const };
    const tool = defineTool(spec);
    expect(tool).toBe(spec);
  });

  it('infers TScratch from initScratch return type', () => {
    const tool = defineTool({
      id: 'pen',
      initScratch: () => ({ anchors: [] as { x: number; y: number }[] }),
      drag: {
        onMove: (_e, ctx) => {
          // If TScratch is properly inferred, ctx.scratch.anchors is typed.
          expectTypeOf(ctx.scratch.anchors).toEqualTypeOf<{ x: number; y: number }[]>();
          return 'claim';
        },
      },
    });
    expect(tool.id).toBe('pen');
  });

  it('defaults TScratch to undefined when initScratch is omitted', () => {
    const tool = defineTool({
      id: 'hand',
      drag: {
        onStart: (_e, ctx) => {
          expectTypeOf(ctx.scratch).toEqualTypeOf<undefined>();
          return 'claim';
        },
      },
    });
    expect(tool.id).toBe('hand');
  });
});
