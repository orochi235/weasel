// Counts the stories the workshop renders in their own frame document and fails when there are more
// than it allows. Reads story sources statically and never starts vite, so it is fast.
import { globSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';

// This number only goes down. Raising it is a reviewed edit to this file, and the story that
// needs it carries the reason in its `isolate`.
const ALLOWED = 1;

const repoRoot = resolve(import.meta.dirname, '../../..');

// The forge source imports its siblings without extensions, which vite resolves and node's type stripping does not.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || (error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw error;
      for (const extension of ['.ts', '.tsx']) {
        try {
          return next(`${specifier}${extension}`, context);
        } catch {}
      }
      throw error;
    }
  },
});

const { indexFile } = await import('../src/vite/indexFile.ts');
const { autoTitle } = await import('../src/vite/autoTitle.ts');
const { isolateReport } = await import('../src/vite/isolateReport.ts');
const { stories } = await import('../../../apps/forge/viteShared.ts');

const files = [...new Set(stories.flatMap((pattern) => globSync(pattern, { cwd: repoRoot })))].sort();
const entries = files.flatMap((path) => {
  const file = resolve(repoRoot, path);
  return indexFile(readFileSync(file, 'utf8'), file, autoTitle(file, repoRoot, stories));
});

const { lines, ok } = isolateReport(entries, ALLOWED);
console.log(lines.join('\n'));
process.exit(ok ? 0 : 1);
