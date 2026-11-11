// @vitest-environment node
/**
 * Property test of the FlateDecode compressor: Node's zlib, an independent inflater, reads back any
 * bytes it compresses.
 */
import { inflateSync } from 'node:zlib';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { deflate } from './deflate';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = 100;

describe('deflate', () => {
  it('compresses any bytes into a zlib stream that inflates back to them', async () => {
    const bytes = fc.oneof(
      fc.uint8Array({ maxLength: 2000 }),
      fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 70_000 })).map(([b, n]) => new Uint8Array(n).fill(b)),
    );
    await fc.assert(
      fc.asyncProperty(bytes, async (b) => {
        const z = await deflate(b);
        // A zlib header: deflate with a 32K window, its check bits right.
        expect(z[0]! & 0x0f).toBe(8);
        expect(((z[0]! << 8) | z[1]!) % 31).toBe(0);
        expect(new Uint8Array(inflateSync(z))).toEqual(b);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 20));
});
