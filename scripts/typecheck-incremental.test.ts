import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const TSC = join(import.meta.dirname, '../node_modules/.bin/tsc');
const run = promisify(execFile);

let dir: string;
const put = (name: string, text: string) => writeFileSync(join(dir, name), text);
const tsc = async () => {
  try {
    await run(TSC, ['--noEmit', '-p', dir], { encoding: 'utf8' });
    return { code: 0, out: '' };
  } catch (error) {
    const { code, stdout } = error as { code: number; stdout: string };
    return { code, out: stdout };
  }
};

/** Puts `text` in `name` and turns its mtime back, so only the content says it changed. */
const putKeepingTime = (name: string, text: string) => {
  const { atime, mtime } = statSync(join(dir, name));
  put(name, text);
  utimesSync(join(dir, name), atime, mtime);
};

// The fleet keeps `.tsbuildinfo/` between runs (onto's sync spares ignored files), so a build info
// written for one commit is read by the next. These hold tsc to finding an error that build info
// recorded as clean.
describe('typecheck build info kept from an earlier tree', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tsc-incremental-'));
    put('tsconfig.json', JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, incremental: true, tsBuildInfoFile: './.tsbuildinfo/main.tsbuildinfo', module: 'ESNext', moduleResolution: 'Bundler', skipLibCheck: true, types: [] },
      include: ['*.ts'],
    }));
    put('a.ts', 'export const n: number = 1;\n');
    put('b.ts', "import { n } from './a';\nexport const twice: number = n * 2;\n");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('fails an unchanged file when what it imports changes, though its mtime did not', async () => {
    expect((await tsc()).code).toBe(0);
    expect(existsSync(join(dir, '.tsbuildinfo/main.tsbuildinfo'))).toBe(true);
    putKeepingTime('a.ts', "export const n: string = '1';\n");
    const broken = await tsc();
    expect(broken.code).not.toBe(0);
    expect(broken.out).toMatch(/b\.ts.*TS2362/);
  });

  it('keeps failing on a second run over the same build info', async () => {
    expect((await tsc()).code).toBe(0);
    putKeepingTime('a.ts', "export const n: string = '1';\n");
    expect((await tsc()).code).not.toBe(0);
    expect((await tsc()).code).not.toBe(0);
  });

  it('passes again once the tree is back where the build info was clean', async () => {
    expect((await tsc()).code).toBe(0);
    putKeepingTime('a.ts', "export const n: string = '1';\n");
    expect((await tsc()).code).not.toBe(0);
    putKeepingTime('a.ts', 'export const n: number = 1;\n');
    expect((await tsc()).code).toBe(0);
  });
});
