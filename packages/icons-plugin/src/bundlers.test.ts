import { describe, expect, it } from 'vitest';
import { assertBundler } from './bundlers';
import { weaselIcons } from './index';

const OTHERS = ['webpack', 'rspack', 'rsbuild', 'farm', 'bun', 'unloader'];

describe('the bundlers weaselIcons runs under', () => {
  it('runs app mode under vite, rollup and rolldown only', () => {
    for (const b of ['vite', 'rollup', 'rolldown']) expect(() => assertBundler('app', b)).not.toThrow();
    for (const b of ['esbuild', ...OTHERS]) {
      expect(() => assertBundler('app', b)).toThrow(`app mode runs under vite, rollup, rolldown, not ${b}`);
    }
  });

  it('runs library mode under esbuild too, and nothing else', () => {
    for (const b of ['vite', 'rollup', 'rolldown', 'esbuild']) expect(() => assertBundler('library', b)).not.toThrow();
    for (const b of OTHERS) expect(() => assertBundler('library', b)).toThrow(`library mode runs under vite, rollup, rolldown, esbuild, not ${b}`);
  });

  it('refuses through the adapters themselves when they are created', () => {
    expect(() => weaselIcons.esbuild({ mode: 'app' })).toThrow(/not esbuild/);
    expect(() => weaselIcons.farm({ mode: 'library' })).toThrow(/not farm/);
    expect(() => weaselIcons.esbuild({ mode: 'library' })).not.toThrow();
    expect(() => weaselIcons.vite({ mode: 'app' })).not.toThrow();
  });
});
