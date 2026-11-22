// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatError, outDirPolicy } from './policy';

describe('outDirPolicy', () => {
  const cwd = '/work/app';

  it('refuses the current directory', () => {
    expect(outDirPolicy('.', cwd, cwd)).toEqual({
      ok: false,
      reason: 'refusing to build into /work/app: it contains the current directory',
    });
  });

  it('refuses a parent of the current directory, relative or absolute', () => {
    expect(outDirPolicy('..', cwd, cwd)).toMatchObject({ ok: false, reason: expect.stringContaining(' /work:') });
    expect(outDirPolicy('/', cwd, cwd)).toMatchObject({ ok: false });
    expect(outDirPolicy('/work', cwd, cwd)).toMatchObject({ ok: false });
  });

  it('empties a subdirectory of the project root', () => {
    expect(outDirPolicy('dist', cwd, cwd)).toEqual({ ok: true, outDir: '/work/app/dist', emptyOutDir: true });
    expect(outDirPolicy('/work/app/site/out', cwd, cwd)).toEqual({
      ok: true,
      outDir: '/work/app/site/out',
      emptyOutDir: true,
    });
    expect(outDirPolicy('..cache', cwd, cwd)).toEqual({ ok: true, outDir: '/work/app/..cache', emptyOutDir: true });
  });

  it('builds into a directory outside the root without emptying it', () => {
    expect(outDirPolicy('../other', cwd, cwd)).toEqual({ ok: true, outDir: '/work/other', emptyOutDir: false });
    expect(outDirPolicy('/work/app..x', cwd, cwd)).toEqual({ ok: true, outDir: '/work/app..x', emptyOutDir: false });
  });

  it("follows the config's own emptyOutDir", () => {
    expect(outDirPolicy('../other', cwd, cwd, true)).toEqual({ ok: true, outDir: '/work/other', emptyOutDir: true });
    expect(outDirPolicy('dist', cwd, cwd, false)).toEqual({ ok: true, outDir: '/work/app/dist', emptyOutDir: false });
  });

  it('refuses the root itself, or a directory holding it, whatever the config says', () => {
    expect(outDirPolicy('site', cwd, '/work/app/site')).toEqual({
      ok: false,
      reason: 'refusing to build into /work/app/site: it contains the vite root /work/app/site',
    });
    expect(outDirPolicy('site', cwd, '/work/app/site', true)).toMatchObject({ ok: false });
    expect(outDirPolicy('site', cwd, '/work/app/site/src', false)).toMatchObject({ ok: false });
  });
});

describe('formatError', () => {
  const error = new Error('config exploded');

  it('prints the message alone', () => {
    expect(formatError(error, {})).toBe('weaselforge: config exploded');
  });

  it('adds the stack when WEASELFORGE_DEBUG is set', () => {
    expect(formatError(error, { WEASELFORGE_DEBUG: '1' })).toBe(`weaselforge: config exploded\n${error.stack}`);
  });

  it('prints a thrown non-error as a string', () => {
    expect(formatError('nope', { WEASELFORGE_DEBUG: '1' })).toBe('weaselforge: nope');
  });
});
