import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DragSample, WorldPoint } from '@weasel-js/routing';
import type { InsertExtras, InsertNodeFactories, InsertNodeFactory } from '@weasel-js/core';

// Every check here is enforced by `npm run typecheck`; the runtime body only
// keeps vitest from reporting an empty file.

describe('InsertNodeFactories', () => {
  it("hands a kit kind's entry that kind's own extras", () => {
    const factories: InsertNodeFactories = {
      pencil: (_bounds, extras) => {
        expectTypeOf(extras.samples).toEqualTypeOf<ReadonlyArray<DragSample>>();
        return extras.samples.length < 2 ? null : { data: { n: extras.samples.length } };
      },
      line: (_bounds, { a, b }) => {
        expectTypeOf(a).toEqualTypeOf<WorldPoint>();
        return { data: { a, b } };
      },
    };
    const built = factories.pencil!({ x: 0, y: 0, width: 1, height: 1 }, { kind: 'pencil', samples: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
    expect(built).toEqual({ data: { n: 2 } });
  });

  it("gives a consumer kind the open shape, and takes a factory written for any extras", () => {
    const any: InsertNodeFactory = (_bounds, extras) => ({ data: { kind: extras.kind } });
    const factories: InsertNodeFactories = {
      sticky: (_bounds, extras) => {
        expectTypeOf(extras).toEqualTypeOf<InsertExtras>();
        return { data: {} };
      },
      rect: any,
      pencil: any,
    };
    expect(factories.rect).toBe(any);
  });

  it("refuses an entry written for another kind's extras", () => {
    const pencilOnly: InsertNodeFactory<Extract<InsertExtras, { kind: 'pencil' }>> = () => null;
    // @ts-expect-error: `line` hands its entry `{ a, b }`, not samples
    const factories: InsertNodeFactories = { line: pencilOnly };
    expect(factories.line).toBe(pencilOnly);
  });
});
