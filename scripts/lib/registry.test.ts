import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error — plain .mjs with no typings; `scripts/` is outside tsconfig's include.
import { hasVersion, isPublished } from './registry.mjs';

const TARBALL = 'https://registry.npmjs.org/@weasel-js/hud/-/hud-1.4.3.tgz';

const reply = (status: number) => ({
  status,
  statusText: `status ${status}`,
  json: async () => ({ dist: { tarball: TARBALL } }),
});

/**
 * A fetch whose manifest and tarball URLs each answer their statuses in order,
 * then repeat the last one.
 */
function fetchServing({ manifest, tarball }: { manifest: number[]; tarball: number[] }) {
  const calls: string[] = [];
  const seen = { manifest: 0, tarball: 0 };
  const fake = vi.fn(async (url: string) => {
    calls.push(url);
    const which = url === TARBALL ? 'tarball' : 'manifest';
    const statuses = which === 'tarball' ? tarball : manifest;
    return reply(statuses[Math.min(seen[which]++, statuses.length - 1)]);
  });
  vi.stubGlobal('fetch', fake);
  return calls;
}

/** The manifest answers `statuses`; the tarball is always served. */
const fetchReturning = (...statuses: number[]) => fetchServing({ manifest: statuses, tarball: [200] });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hasVersion', () => {
  it('asks for the version manifest directly, with the scope escaped, then its tarball', async () => {
    const calls = fetchReturning(200);
    await hasVersion('@weasel-js/hud', '1.4.3');
    expect(calls).toEqual(['https://registry.npmjs.org/@weasel-js%2fhud/1.4.3', TARBALL]);
  });

  // 1.7.1: the manifest listed while the tarball still answered 404, and the
  // registry smoke install failed on it with E404.
  it('retries a listed version whose tarball is not served yet', async () => {
    const calls = fetchServing({ manifest: [200], tarball: [404, 200] });
    await expect(hasVersion('@weasel-js/hud', '1.4.3', { attempts: 5, delayMs: 0 })).resolves.toBe(
      true,
    );
    expect(calls.filter((u) => u === TARBALL)).toHaveLength(2);
  });

  it('reports a version missing while its tarball never serves', async () => {
    fetchServing({ manifest: [200], tarball: [404] });
    await expect(hasVersion('@weasel-js/hud', '1.4.3', { attempts: 3, delayMs: 0 })).resolves.toBe(
      false,
    );
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
    expect(calls.filter((u) => u !== TARBALL)).toHaveLength(3);
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
