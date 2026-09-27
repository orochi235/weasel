import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error — plain .mjs with no typings; `scripts/` is outside tsconfig's include.
import { isStagedConflict, shimNpm } from './npm-shim.mjs';

// What `npm publish --json` prints for the npm/cli#9889 conflict.
const STAGED_STDOUT = JSON.stringify({
  error: {
    code: 'E409',
    summary:
      '409 Conflict - PUT https://registry.npmjs.org/@weasel-js%2fhud - Cannot publish over previously staged version "1.6.1".',
    detail: '',
  },
});
const PUBLISHED_STDOUT = JSON.stringify({
  error: {
    code: 'E403',
    summary: 'You cannot publish over the previously published versions: 1.6.1.',
    detail: '',
  },
});

const io = () => ({ out: vi.fn(), err: vi.fn() });

describe('isStagedConflict', () => {
  it('matches the E409 staged-version reply', () => {
    expect(isStagedConflict({ stdout: STAGED_STDOUT, stderr: '' })).toBe(true);
  });

  it('matches it in plain-text stderr too', () => {
    expect(
      isStagedConflict({
        stdout: '',
        stderr: 'npm error code E409\nnpm error 409 Conflict - Cannot publish over previously staged version "1.6.1".',
      }),
    ).toBe(true);
  });

  it('does not match other publish failures', () => {
    expect(isStagedConflict({ stdout: PUBLISHED_STDOUT, stderr: '' })).toBe(false);
    expect(isStagedConflict({ stdout: '', stderr: 'npm error code E409\nnpm error 409 Conflict' })).toBe(false);
  });
});

describe('shimNpm', () => {
  it('turns a staged-version E409 on publish into success', async () => {
    const run = vi.fn(async () => ({ code: 1, stdout: STAGED_STDOUT, stderr: '' }));
    const { out, err } = io();
    const code = await shimNpm(['publish', '--json', '--access', 'public'], { run, out, err });
    expect(code).toBe(0);
    expect(run).toHaveBeenCalledWith(['publish', '--json', '--access', 'public'], { capture: true });
    expect(err.mock.calls.join('')).toMatch(/already holds/);
  });

  it('passes every other publish failure through unchanged', async () => {
    const run = vi.fn(async () => ({ code: 1, stdout: PUBLISHED_STDOUT, stderr: 'boom' }));
    const { out, err } = io();
    const code = await shimNpm(['publish', '--json'], { run, out, err });
    expect(code).toBe(1);
    expect(out).toHaveBeenCalledWith(PUBLISHED_STDOUT);
    expect(err).toHaveBeenCalledWith('boom');
  });

  it('passes a successful publish through unchanged', async () => {
    const run = vi.fn(async () => ({ code: 0, stdout: '{"id":"x"}', stderr: '' }));
    const { out, err } = io();
    expect(await shimNpm(['publish', '--json'], { run, out, err })).toBe(0);
    expect(out).toHaveBeenCalledWith('{"id":"x"}');
  });

  it('runs anything that is not a publish without capturing it', async () => {
    const run = vi.fn(async () => ({ code: 7 }));
    const { out, err } = io();
    expect(await shimNpm(['info', '@weasel-js/hud', '--json'], { run, out, err })).toBe(7);
    expect(run).toHaveBeenCalledWith(['info', '@weasel-js/hud', '--json'], { capture: false });
  });
});
