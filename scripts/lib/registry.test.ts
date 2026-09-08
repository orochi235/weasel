import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error — plain .mjs with no typings; `scripts/` is outside tsconfig's include.
import { hasVersion, isPublished } from './registry.mjs';

const reply = (status: number) => ({ status, statusText: `status ${status}` });

/** A fetch that answers the given statuses in order, then repeats the last one. */
function fetchReturning(...statuses: number[]) {
  const calls: string[] = [];
  const fake = vi.fn(async (url: string) => {
    calls.push(url);
    return reply(statuses[Math.min(calls.length - 1, statuses.length - 1)]);
  });
  vi.stubGlobal('fetch', fake);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hasVersion', () => {
  it('asks for the version manifest directly, with the scope escaped', async () => {
    const calls = fetchReturning(200);
    await hasVersion('@weasel-js/hud', '1.4.3');
    expect(calls).toEqual(['https://registry.npmjs.org/@weasel-js%2fhud/1.4.3']);
  });

  it('is true when the registry serves that version', async () => {
    fetchReturning(200);
    await expect(hasVersion('@weasel-js/hud', '1.4.3')).resolves.toBe(true);
  });

  // The reason this check retries at all: it runs seconds after the publish,
  // when a read replica can still be answering 404 for a version that exists.
  it('retries a 404, so propagation lag does not read as a failed publish', async () => {
    const calls = fetchReturning(404, 404, 200);
    await expect(hasVersion('@weasel-js/hud', '1.4.3', { attempts: 5, delayMs: 0 })).resolves.toBe(
      true,
    );
    expect(calls).toHaveLength(3);
  });

  it('gives up after the last attempt and reports the version missing', async () => {
    const calls = fetchReturning(404);
    await expect(hasVersion('@weasel-js/hud', '9.9.9', { attempts: 3, delayMs: 0 })).resolves.toBe(
      false,
    );
    expect(calls).toHaveLength(3);
  });

  // A 500 is the registry being unwell, not an answer about the version. Reading
  // it as absence would fail a release that published perfectly well.
  it('throws on any status that is not 200 or 404', async () => {
    fetchReturning(503);
    await expect(hasVersion('@weasel-js/hud', '1.4.3', { attempts: 1, delayMs: 0 })).rejects.toThrow(
      /@weasel-js\/hud@1\.4\.3: registry answered 503/,
    );
  });
});

describe('isPublished', () => {
  it('asks for the packument, not a version', async () => {
    const calls = fetchReturning(200);
    await isPublished('@weasel-js/hud');
    expect(calls).toEqual(['https://registry.npmjs.org/@weasel-js%2fhud']);
  });
});
