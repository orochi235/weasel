import { dirname, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../story/types';
import { createDepGraph } from './depGraph';

const ROOT = '/repo';

/** An in-memory workspace: relative imports and a `@ui` alias for the ui barrel, as vite's resolver would answer. */
function workspace(files: Record<string, string>) {
  const abs = (path: string) => `${ROOT}/${path}`;
  const table = new Map(Object.entries(files).map(([path, code]) => [abs(path), code]));
  const reads: string[] = [];
  const find = (base: string): string | null => {
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (table.has(candidate)) return candidate;
    }
    return null;
  };
  const resolve = async (spec: string, importer: string): Promise<string | null> => {
    if (spec === '@ui') return abs('ui/index.ts');
    if (spec.startsWith('.')) return find(resolvePath(dirname(importer), spec));
    return null;
  };
  const read = (file: string): string => {
    reads.push(file);
    const code = table.get(file);
    if (code === undefined) throw new Error(`no file ${file}`);
    return code;
  };
  return { abs, table, reads, resolve, read };
}

const entry = (title: string, file: string, extra: Partial<IndexEntry> = {}): IndexEntry => ({
  id: `${title}--a`,
  title,
  name: 'A',
  exportName: 'A',
  file: `${ROOT}/${file}`,
  ...extra,
});

const FILES = {
  'ui/index.ts': `export * from './Button/Button';\nexport * from './Dialog';\nexport { Badge } from './Badge/Badge';\n`,
  'ui/Button/Button.tsx': `import { Badge } from '../Badge/Badge';\nexport function Button() { return <Badge />; }\n`,
  'ui/Badge/Badge.tsx': `export const Badge = () => null;\n`,
  'ui/Dialog/index.ts': `export { Dialog } from './Dialog';\n`,
  'ui/Dialog/Dialog.tsx': `import { Button } from '../Button/Button';\nimport { Footer } from './Footer';\nexport const Dialog = () => <Footer><Button /></Footer>;\n`,
  'ui/Dialog/Footer.tsx': `import { Badge } from '@ui';\nexport const Footer = () => <Badge />;\n`,
  'stories/Button.stories.tsx': `import { Button } from '@ui';\nexport default { title: 'ui/Button', component: Button };\nexport const A = {};\n`,
  'stories/Badge.stories.tsx': `import { Badge } from '@ui';\nexport default { title: 'ui/Badge', component: Badge };\nexport const A = {};\n`,
  'stories/Dialog.stories.tsx': `import { Dialog } from '../ui/Dialog';\nexport default { title: 'ui/Dialog', component: Dialog };\nexport const A = {};\n`,
};

const ENTRIES = [
  entry('ui/Button', 'stories/Button.stories.tsx', { componentName: 'Button' }),
  entry('ui/Badge', 'stories/Badge.stories.tsx', { componentName: 'Badge' }),
  entry('ui/Dialog', 'stories/Dialog.stories.tsx', { componentName: 'Dialog' }),
];

describe('createDepGraph', () => {
  it('links components through barrels, re-exports and the component’s own relative files', async () => {
    const ws = workspace(FILES);
    const graph = await createDepGraph({ root: ROOT, read: ws.read }).build(ENTRIES, ws.resolve);
    expect(graph).toEqual({
      'ui/Badge': { source: 'ui/Badge/Badge.tsx', uses: [], usedBy: ['ui/Button', 'ui/Dialog'] },
      'ui/Button': { source: 'ui/Button/Button.tsx', uses: ['ui/Badge'], usedBy: ['ui/Dialog'] },
      'ui/Dialog': { source: 'ui/Dialog/Dialog.tsx', uses: ['ui/Badge', 'ui/Button'], usedBy: [] },
    });
  });

  it('falls back to the import the title names when the meta names no imported component', async () => {
    const ws = workspace({
      ...FILES,
      'stories/Dialog.stories.tsx': `import { Dialog } from '@ui';\nconst Demo = () => <Dialog />;\nexport default { title: 'ui/Dialog', component: Demo };\n`,
    });
    const entries = [...ENTRIES.slice(0, 2), entry('ui/Dialog', 'stories/Dialog.stories.tsx', { componentName: 'Demo' })];
    const graph = await createDepGraph({ root: ROOT, read: ws.read }).build(entries, ws.resolve);
    expect(graph['ui/Dialog']?.source).toBe('ui/Dialog/Dialog.tsx');
  });

  it('gives a component with no findable source no edges, and says so with a null source', async () => {
    const ws = workspace({
      ...FILES,
      'stories/Loose.stories.tsx': `export default { title: 'ui/Loose' };\nexport const A = {};\n`,
    });
    const graph = await createDepGraph({ root: ROOT, read: ws.read }).build(
      [...ENTRIES, entry('ui/Loose', 'stories/Loose.stories.tsx')],
      ws.resolve,
    );
    expect(graph['ui/Loose']).toEqual({ source: null, uses: [], usedBy: [] });
  });

  it('leaves galleries out as nodes', async () => {
    const ws = workspace({
      ...FILES,
      'stories/All.stories.tsx': `import { Dialog } from '@ui';\nexport default { title: 'ui/All', component: Dialog, tags: ['gallery'] };\n`,
    });
    const graph = await createDepGraph({ root: ROOT, read: ws.read }).build(
      [...ENTRIES, entry('ui/All', 'stories/All.stories.tsx', { componentName: 'Dialog', tags: ['gallery'] })],
      ws.resolve,
    );
    expect(Object.keys(graph)).not.toContain('ui/All');
    expect(graph['ui/Button']?.usedBy).toEqual(['ui/Dialog']);
  });

  it('counts only the imports the component’s own declaration reaches in a file it shares', async () => {
    const ws = workspace({
      ...FILES,
      'ui/Button/Button.tsx': `import { Badge } from '../Badge/Badge';\nconst Label = () => <Badge />;\nexport function Button() { return <Label />; }\nexport function Plain() { return null; }\n`,
      'stories/Plain.stories.tsx': `import { Plain } from '../ui/Button/Button';\nexport default { title: 'ui/Plain', component: Plain };\n`,
    });
    const graph = await createDepGraph({ root: ROOT, read: ws.read }).build(
      [...ENTRIES, entry('ui/Plain', 'stories/Plain.stories.tsx', { componentName: 'Plain' })],
      ws.resolve,
    );
    expect(graph['ui/Button']?.uses).toEqual(['ui/Badge']);
    expect(graph['ui/Plain']?.uses).toEqual([]);
  });

  it('re-reads only the files an invalidation names', async () => {
    const ws = workspace(FILES);
    const deps = createDepGraph({ root: ROOT, read: ws.read });
    await deps.build(ENTRIES, ws.resolve);
    ws.reads.length = 0;
    ws.table.set(ws.abs('ui/Badge/Badge.tsx'), `import { Button } from '../Button/Button';\nexport const Badge = () => <Button />;\n`);
    expect(deps.invalidate(ws.abs('ui/Badge/Badge.tsx'))).toBe(true);
    expect(deps.invalidate(ws.abs('elsewhere.ts'))).toBe(false);
    const graph = await deps.build(ENTRIES, ws.resolve);
    expect(ws.reads).toEqual([ws.abs('ui/Badge/Badge.tsx')]);
    expect(graph['ui/Badge']?.uses).toEqual(['ui/Button']);
  });

  it('skips a file that fails to parse rather than failing the graph', async () => {
    const ws = workspace({ ...FILES, 'ui/Badge/Badge.tsx': `export const Badge = (` });
    const graph = await createDepGraph({ root: ROOT, read: ws.read }).build(ENTRIES, ws.resolve);
    expect(graph['ui/Badge']).toEqual({ source: null, uses: [], usedBy: [] });
    expect(graph['ui/Button']?.uses).toEqual([]);
  });
});
