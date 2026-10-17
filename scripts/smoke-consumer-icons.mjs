// Phase 5 of the consumer smoke test: a vite app built against the packed tree with
// weaselIcons in app mode must ship the glyphs it names, through its own icon() and
// through a kit package's dist, and no glyph nothing names.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

/** A glyph nothing in the app, ui's Badge, or its chunks names. */
const UNNAMED = 'd20';

/** The path data of a ui glyph, which survives the double JSON encoding of a variant chunk. */
async function pathData(nodeModules, name) {
  const table = JSON.parse(await readFile(join(nodeModules, '@weasel-js/ui/dist/icons.table.json'), 'utf8'));
  const body = table.icons[name]?.body;
  const d = body && /\bd="([^"]+)"/.exec(body)?.[1];
  if (!d) throw new Error(`ui's packed table has no path data for "${name}"`);
  return d;
}

/**
 * @param {{ repoRoot: string, workDir: string, nodeModules: string, external: string[], fail: (msg: string, detail?: string) => never }} ctx
 */
export async function smokeIcons({ repoRoot, workDir, nodeModules, external, fail }) {
  const { weaselIcons } = await import(pathToFileURL(join(repoRoot, 'packages/icons/dist/plugin.js')).href);
  const app = join(workDir, 'icons-app');
  await mkdir(join(app, 'src'), { recursive: true });
  // What gen:icons emits for a root that draws nothing.
  await writeFile(
    join(app, 'src/icons.gen.ts'),
    `import { scopedIcon } from '@weasel-js/icons';\nexport const icon = scopedIcon<never>('app');\n`,
  );
  await writeFile(
    join(app, 'src/main.ts'),
    `import icons from 'virtual:weasel-icons';\n` +
      `import { Badge } from '@weasel-js/ui/components/Badge';\n` +
      `import { icon } from './icons.gen';\n` +
      `const close = { id: 'close', label: 'Close', icon: icon('ui:close') };\n` +
      `Object.assign(globalThis, { icons, close, Badge, all: () => import('virtual:weasel-icons/all') });\n`,
  );
  let out;
  try {
    out = await build({
      root: app,
      configFile: false,
      logLevel: 'silent',
      plugins: [weaselIcons.vite({ mode: 'app' })],
      build: { write: false, minify: true, rollupOptions: { input: join(app, 'src/main.ts'), external } },
    });
  } catch (err) {
    fail('icon app build FAILED under weaselIcons app mode:', err.message ?? String(err));
  } finally {
    await rm(app, { recursive: true, force: true });
  }
  const chunks = (Array.isArray(out) ? out[0] : out).output.filter((o) => o.type === 'chunk');
  const entry = chunks.find((c) => c.isEntry).code;
  const all = chunks.find((c) => c.moduleIds.includes('\0virtual:weasel-icons/all'))?.code ?? '';
  const problems = [];
  const expect = (ok, what) => ok || problems.push(what);
  expect(entry.includes(await pathData(nodeModules, 'close')), "the entry lacks ui:close, named by the app's own icon()");
  expect(entry.includes(await pathData(nodeModules, 'statusSuccess')), "the entry lacks ui:statusSuccess, named only in ui's dist");
  expect(!entry.includes(await pathData(nodeModules, UNNAMED)), `the entry ships ui:${UNNAMED}, which nothing names`);
  expect(all.includes(await pathData(nodeModules, UNNAMED)), `the all variant lacks ui:${UNNAMED}`);
  expect(!chunks.some((c) => c.code.includes('__WEASEL_ICONS__')), 'a chunk still holds a __WEASEL_ICONS__ placeholder');
  if (problems.length) fail('icon app build ships the wrong glyphs:', problems.join('\n'));
  console.log('[smoke] icon app OK — ships what it names, through its own icon() and a kit dist, and nothing else.');
}
