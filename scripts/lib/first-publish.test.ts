import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs with no typings; `scripts/` is outside tsconfig's include.
import { addPending, classify, hasTrustedPublish, readStates } from './first-publish.mjs';

// The shapes below are copied from the registry's packuments for
// `@weasel-js/menu` and `@weasel-js/core` as served on 2026-10-19.
const handPublished = { name: 'msb235', email: 'x@example.com' };
const oidcPublished = {
  name: 'GitHub Actions',
  email: 'npm-oidc-no-reply@github.com',
  trustedPublisher: { id: 'github', oidcConfigId: '6422d543-2f71-43a3-9068-cee8595c994c' },
};
const packument = (...publishers: object[]) => ({
  versions: Object.fromEntries(publishers.map((u, i) => [`1.${i}.0`, { _npmUser: u }])),
});

describe('hasTrustedPublish', () => {
  // 1.11.0's release died on menu: published by hand at 1.10.1, never
  // registered, and the old gate only asked whether the name existed.
  it('is false for a package only ever published by hand', () => {
    expect(hasTrustedPublish(packument(handPublished, handPublished))).toBe(false);
  });

  it('is true once any version came from a trusted publisher', () => {
    expect(hasTrustedPublish(packument(handPublished, oidcPublished, handPublished))).toBe(true);
  });

  // A provenance attestation also comes from a CI publish with a token and
  // --provenance, so it says nothing about trust config.
  it('ignores an attestation without a trusted publisher', () => {
    const attested = {
      versions: {
        '1.0.0': {
          _npmUser: handPublished,
          dist: { attestations: { url: 'https://registry.npmjs.org/-/npm/v1/attestations/x@1.0.0' } },
        },
      },
    };
    expect(hasTrustedPublish(attested)).toBe(false);
  });
});

describe('classify', () => {
  const states = [
    { name: '@weasel-js/core', packument: packument(oidcPublished) },
    { name: '@weasel-js/menu', packument: packument(handPublished) },
    { name: '@weasel-js/new', packument: null },
    { name: '@weasel-js/seeded', packument: packument(handPublished) },
    { name: '@weasel-js/landed', packument: packument(handPublished, oidcPublished) },
  ];

  it('sorts packages into ok, missing, untrusted, pending, and stale', () => {
    expect(classify(states, ['@weasel-js/seeded', '@weasel-js/landed'])).toEqual({
      status: {
        '@weasel-js/core': 'ok',
        '@weasel-js/menu': 'untrusted',
        '@weasel-js/new': 'missing',
        '@weasel-js/seeded': 'pending',
        '@weasel-js/landed': 'ok',
      },
      missing: ['@weasel-js/new'],
      untrusted: ['@weasel-js/menu'],
      stale: ['@weasel-js/landed'],
    });
  });

  it('fails a hand-published package nobody recorded as registered', () => {
    expect(classify(states, []).untrusted).toEqual(['@weasel-js/menu', '@weasel-js/seeded']);
  });

  // A pending entry for a package that does not exist yet still needs the
  // hand publish: the entry vouches for trust config, not for the package.
  it('still reports a pending package missing when it was never published', () => {
    const result = classify([{ name: '@weasel-js/new', packument: null }], ['@weasel-js/new']);
    expect(result.missing).toEqual(['@weasel-js/new']);
  });
});

describe('addPending', () => {
  it('adds names once and keeps the list sorted', () => {
    expect(addPending(['@weasel-js/b'], ['@weasel-js/a', '@weasel-js/b'])).toEqual([
      '@weasel-js/a',
      '@weasel-js/b',
    ]);
  });
});

describe('readStates', () => {
  const answer = (status: number, body: unknown = {}) => async () =>
    ({ status, json: async () => body }) as Response;
  const byName = (map: Record<string, () => Promise<Response>>) => async (url: string) =>
    map[decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))]();
  const fetch = byName({
    '@weasel-js/core': answer(200, packument(oidcPublished)),
    '@weasel-js/symmetry': answer(502),
  });
  const opts = { fetch, attempts: 1, delayMs: 0 };

  // On 2026-10-21 npm answered 502 for symmetry alone, and the --warn gate exited 1.
  it('with warn, reports a registry error instead of throwing', async () => {
    const { states, errors } = await readStates(['@weasel-js/core', '@weasel-js/symmetry'], {
      ...opts,
      warn: true,
    });
    expect(states.map((s: { name: string }) => s.name)).toEqual(['@weasel-js/core']);
    expect(errors).toEqual([{ name: '@weasel-js/symmetry', message: '@weasel-js/symmetry: registry answered 502' }]);
  });

  it('without warn, a registry error is fatal', async () => {
    await expect(readStates(['@weasel-js/core', '@weasel-js/symmetry'], opts)).rejects.toThrow(
      'registry answered 502',
    );
  });

  it('reads a 404 as never published, not as an error', async () => {
    const { states, errors } = await readStates(['@weasel-js/new'], {
      ...opts,
      warn: true,
      fetch: byName({ '@weasel-js/new': answer(404) }),
    });
    expect(states).toEqual([{ name: '@weasel-js/new', packument: null }]);
    expect(errors).toEqual([]);
  });
});
