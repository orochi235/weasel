import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiSrc = join(dirname(fileURLToPath(import.meta.url)), '../..');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(entry)) yield p;
  }
}

/** The two modules allowed to name React Aria's unstable surface, so an
 *  upstream rename lands in a known place rather than across the package. */
const QUARANTINE = ['/components/Toast/', '/overlays/portalHost.tsx'];

describe('RAC unstable containment', () => {
  it('UNSTABLE_ imports appear only in the quarantined modules', () => {
    const offenders = [...walk(uiSrc)].filter(
      (f) => !QUARANTINE.some((q) => f.includes(q)) && readFileSync(f, 'utf8').includes('UNSTABLE_'),
    );
    expect(offenders).toEqual([]);
  });
});
