import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

/**
 * A CSS-module class name that depends on the file's path and never on its
 * contents. Vite's default hashes the whole stylesheet, so one edited rule
 * renames every class in the file, and a consumer holding an older copy of the
 * sheet (labkit's `dist/styles.css`, or the ui JS labkit inlines) loses the
 * whole component rather than the one rule.
 */
export function stableScopedName(local: string, file: string): string {
  const path = relative(repoRoot, file.split('?')[0]!).replaceAll('\\', '/');
  return `_${local}_${createHash('sha256').update(path).digest('hex').slice(0, 6)}`;
}
