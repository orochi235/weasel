import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as tsup } from 'tsup';
import { build, type Rollup } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import { weaselIcons } from './index';

const lib = fileURLToPath(new URL('./fixtures/lib', import.meta.url));
const app = fileURLToPath(new URL('./fixtures/app', import.meta.url));
const iconsSrc = fileURLToPath(new URL('../../icons/src/index.ts', import.meta.url));
const ANNOTATED = /\/\* @icon \*\/\s*['"]lib:star['"]/g;
const annotations = (out: string) => out.match(ANNOTATED)?.length ?? 0;

const outDirs: string[] = [];
afterAll(() => outDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

async function viteLibrary(minify: boolean) {
  const out = await build({
    root: lib,
    logLevel: 'silent',
    configFile: false,
    plugins: [weaselIcons.vite({ mode: 'library' })],
    build: {
      write: false,
      minify,
      lib: { entry: `${lib}/src/index.ts`, formats: ['es'], fileName: 'index' },
      rollupOptions: { external: ['@weasel-js/icons'], output: { minify } },
    },
  });
  const result = Array.isArray(out) ? out[0]! : (out as Rollup.RollupOutput);
  return result.output.filter((o): o is Rollup.OutputChunk => o.type === 'chunk').map((c) => c.code).join('\n');
}

describe('weaselIcons library mode', () => {
  it('ships annotated, qualified literals in dist and no icon() call', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'weasel-icons-lib-'));
    outDirs.push(outDir);
    await tsup({
      entry: { index: `${lib}/src/index.ts` },
      outDir,
      format: ['esm'],
      silent: true,
      config: false,
      external: ['@weasel-js/icons'],
      esbuildPlugins: [weaselIcons.esbuild({ mode: 'library' })],
    });
    const out = readFileSync(join(outDir, 'index.js'), 'utf8');
    expect(annotations(out)).toBe(3);
    expect(out).not.toMatch(/\bicon\(/);
  });

  it('keeps the annotation through an unminified vite library build', async () => {
    const out = await viteLibrary(false);
    expect(annotations(out)).toBe(3);
    expect(out).not.toMatch(/\bicon\(/);
  });

  it('fails a vite library build that strips every annotation', async () => {
    await expect(viteLibrary(true)).rejects.toThrow(/stripped every @icon annotation/);
  });
});

describe('weaselIcons on a root that draws nothing', () => {
  it('collects a qualified name written through its generated icon()', async () => {
    const out = await build({
      root: app,
      logLevel: 'silent',
      configFile: false,
      resolve: { alias: { '@weasel-js/icons': iconsSrc } },
      plugins: [weaselIcons.vite({ mode: 'app' })],
      build: { write: false, minify: false, rollupOptions: { input: `${app}/src/consumer.ts` } },
    });
    const result = Array.isArray(out) ? out[0]! : (out as Rollup.RollupOutput);
    const entry = result.output.find((o): o is Rollup.OutputChunk => o.type === 'chunk' && o.isEntry)!.code;
    expect(entry).toContain('fx-ring-body');
    expect(entry).toContain('fx-dot-body');
    expect(entry).not.toContain('lib-moon-body');
  });
});
