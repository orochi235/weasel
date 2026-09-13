// Loads every indexed story file through the forge dev app's vite config, the way a frame would, and reports what fails.
import { relative, resolve } from 'node:path';
import { createServer } from 'vite';

interface IndexEntry {
  id: string;
  file: string;
  exportName: string;
}

interface LoadedStory {
  id: string;
  config: unknown;
}

const repoRoot = resolve(import.meta.dirname, '../../..');

const server = await createServer({
  configFile: resolve(repoRoot, 'apps/forge/vite.config.ts'),
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
});

const faults: string[] = [];
try {
  const index = (await server.ssrLoadModule('virtual:forge/index.js')).default as IndexEntry[];
  const { loadStories } = await server.ssrLoadModule('/packages/forge/src/frame/mountFrame.tsx');
  const { describeSchema } = await server.ssrLoadModule('/packages/forge/src/protocol/schema.ts');

  const byFile = new Map<string, IndexEntry[]>();
  for (const entry of index) byFile.set(entry.file, [...(byFile.get(entry.file) ?? []), entry]);

  const total = byFile.size;
  const width = String(total).length;
  let n = 0;
  for (const [file, entries] of byFile) {
    const path = relative(repoRoot, file);
    const position = `${String(++n).padStart(width)}/${total}`;
    const fileFaults: string[] = [];
    let count = 0;
    try {
      const mod = await server.ssrLoadModule(file);
      const stories = loadStories(mod, file, server.config.root) as LoadedStory[];
      count = stories.length;
      for (const story of stories) {
        try {
          structuredClone(describeSchema(story.config));
        } catch (error) {
          fileFaults.push(`${story.id}: schema: ${message(error)}`);
        }
      }
      const indexed = new Set(entries.map((e) => e.id));
      const loaded = new Set(stories.map((s) => s.id));
      for (const id of indexed) if (!loaded.has(id)) fileFaults.push(`${id}: indexed, but the loader produced no such story`);
      for (const id of loaded) if (!indexed.has(id)) fileFaults.push(`${id}: loaded, but the index has no such story`);
    } catch (error) {
      fileFaults.push(message(error));
    }
    if (fileFaults.length === 0) {
      console.log(`  ${position} ${path}  ok  (${count} ${count === 1 ? 'story' : 'stories'})`);
    } else {
      console.log(`  ${position} ${path}  FAIL  ${fileFaults[0]}${fileFaults.length > 1 ? ` (+${fileFaults.length - 1} more)` : ''}`);
      faults.push(...fileFaults.map((f) => `${path}: ${f}`));
    }
  }
  console.log(`\n${total} files, ${index.length} indexed stories, ${faults.length} ${faults.length === 1 ? 'fault' : 'faults'}`);
} catch (error) {
  faults.push(`setup: ${message(error)}`);
} finally {
  await server.close();
}

if (faults.length > 0) {
  console.log(`\nFaults:\n${faults.map((f) => `  ${f}`).join('\n')}`);
  process.exit(1);
}
process.exit(0);

function message(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}
