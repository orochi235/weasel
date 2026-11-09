// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cssDependencyKey, cssDependencySpecifiers } from './vitest-css-cache-key.ts';

const VITEST = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
const PLUGIN = join(import.meta.dirname, 'vitest-css-cache-key.ts');

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'css-cache-key-')));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const write = (name: string, text: string) => writeFileSync(join(root, name), text);

describe('cssDependencyKey', () => {
  it('changes when a sheet reached through @import or composes changes, at any depth', () => {
    mkdirSync(join(root, 'theme'));
    write('a.module.css', "@import './b.css';\n.x { composes: y from './c.module.css'; }\n.n { composes: n from '@t/n.css'; }\n");
    write('b.css', "@import url('./d.css');\n");
    write('c.module.css', '.y {}\n');
    write('d.css', '.d {}\n');
    write('theme/n.css', '.n {}\n');
    const aliases = [{ find: /^@t\/(.*)$/, replacement: join(root, 'theme', '$1') }];
    const key = () => cssDependencyKey(join(root, 'a.module.css'), aliases);
    const seen = new Set([key()]);
    for (const sheet of ['b.css', 'c.module.css', 'd.css', 'theme/n.css']) {
      appendFileSync(join(root, sheet), `.added-${seen.size} {}\n`);
      seen.add(key());
    }
    expect(seen.size).toBe(5);
  });

  it('survives an import cycle and a missing sheet', () => {
    write('a.css', "@import './b.css';\n@import './gone.css';\n");
    write('b.css', "@import './a.css';\n");
    expect(cssDependencyKey(join(root, 'a.css'))).toContain('gone.css');
  });
});

describe('cssDependencySpecifiers', () => {
  it('reads a sheet named after a comment opener inside a string', () => {
    expect(cssDependencySpecifiers(".a { content: '/*'; }\n.b { composes: c from './c.module.css'; }\n.d { content: '*/'; }\n")).toEqual([
      './c.module.css',
    ]);
  });
});

describe('fsModuleCache with the plugin', () => {
  it("serves a module's new class map after only its imported sheet changed", () => {
    write('a.module.css', "@import './b.css';\n.root {}\n");
    write('b.css', '.old {}\n');
    write(
      'probe.test.ts',
      "import { writeFileSync } from 'node:fs';\nimport s from './a.module.css';\n" +
        "test('classes', () => writeFileSync(process.env.PROBE_OUT, JSON.stringify(Object.keys(s).sort())));\n",
    );
    write(
      'vitest.config.mjs',
      `import { cssCacheKey } from ${JSON.stringify(PLUGIN)};\n` +
        `export default { plugins: [cssCacheKey()], test: { globals: true, include: ['probe.test.ts'], css: true, fsModuleCache: true, fsModuleCachePath: ${JSON.stringify(join(root, 'cache'))} } };\n`,
    );
    const out = join(root, 'out.json');
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST') && k !== 'NODE_OPTIONS'));
    const run = () => {
      execFileSync(process.execPath, [VITEST, 'run', '--root', root, '--config', join(root, 'vitest.config.mjs')], {
        cwd: root,
        env: { ...env, PROBE_OUT: out },
        stdio: 'pipe',
      });
      return JSON.parse(readFileSync(out, 'utf8'));
    };
    expect(run()).toEqual(['old', 'root']);
    appendFileSync(join(root, 'b.css'), '.added {}\n');
    expect(run()).toEqual(['added', 'old', 'root']);
  }, 60_000);
});
