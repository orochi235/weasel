// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseCli } from './parse';

describe('parseCli', () => {
  it('reads dev with the default config', () => {
    expect(parseCli(['dev'])).toEqual({ command: 'dev', config: 'vite.config.ts' });
  });

  it('reads dev with a given config', () => {
    expect(parseCli(['dev', '--config', 'apps/forge/vite.config.ts'])).toEqual({
      command: 'dev',
      config: 'apps/forge/vite.config.ts',
    });
  });

  it('reads build with a config and an output directory', () => {
    expect(parseCli(['build', '--config=forge.vite.ts', '--out', 'site'])).toEqual({
      command: 'build',
      config: 'forge.vite.ts',
      out: 'site',
    });
  });

  it('leaves the output directory to the config when build has no --out', () => {
    expect(parseCli(['build'])).toEqual({ command: 'build', config: 'vite.config.ts' });
  });

  it('rejects a missing or unknown command', () => {
    expect(parseCli([])).toEqual({ command: 'usage', error: 'no command given' });
    expect(parseCli(['serve'])).toEqual({ command: 'usage', error: 'unknown command: serve' });
  });

  it('rejects --out on dev, unknown flags, and extra arguments', () => {
    expect(parseCli(['dev', '--out', 'site'])).toMatchObject({ command: 'usage' });
    expect(parseCli(['build', '--port', '1'])).toMatchObject({ command: 'usage' });
    expect(parseCli(['build', 'extra'])).toMatchObject({ command: 'usage' });
    expect(parseCli(['build', '--config'])).toMatchObject({ command: 'usage' });
  });

  it('asks for usage on --help', () => {
    expect(parseCli(['--help'])).toEqual({ command: 'help' });
    expect(parseCli(['build', '-h'])).toEqual({ command: 'help' });
  });
});
