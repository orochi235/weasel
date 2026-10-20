import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentHashes, readCached, writeCached } from './input-cache.mjs';

let dir: string;
const at = (name: string) => join(dir, name);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'input-cache-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('readCached', () => {
  it('returns the result while every input still has the content it was stored with', () => {
    writeFileSync(at('a.ts'), 'a');
    writeFileSync(at('b.ts'), 'b');
    writeCached(at('entry.json'), [at('a.ts'), at('b.ts')], { react: true }, contentHashes());
    expect(readCached(at('entry.json'), contentHashes())).toEqual({ react: true });
  });

  it('misses once an input changes', () => {
    writeFileSync(at('a.ts'), 'a');
    writeCached(at('entry.json'), [at('a.ts')], { react: true }, contentHashes());
    writeFileSync(at('a.ts'), 'changed');
    expect(readCached(at('entry.json'), contentHashes())).toBeUndefined();
  });

  it('misses once an input is gone', () => {
    writeFileSync(at('a.ts'), 'a');
    writeCached(at('entry.json'), [at('a.ts')], { react: true }, contentHashes());
    rmSync(at('a.ts'));
    expect(readCached(at('entry.json'), contentHashes())).toBeUndefined();
  });

  it('misses with nothing stored, or a store it cannot read', () => {
    expect(readCached(at('none.json'), contentHashes())).toBeUndefined();
    writeFileSync(at('bad.json'), '{');
    expect(readCached(at('bad.json'), contentHashes())).toBeUndefined();
  });
});
