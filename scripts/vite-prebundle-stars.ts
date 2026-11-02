import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseSync, transformSync } from 'rolldown/utils';
import { isPathImport, resolvePath } from './vite-prebundle-reach.ts';

/** The names a module exports at runtime, types and its default left out, following its own `export *`s; null
 *  when one of those cannot be followed by path, so the names cannot all be known. */
export function runtimeExportsOf(file: string, read = (f: string) => readFileSync(f, 'utf8'), seen = new Set<string>()): Set<string> | null {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const js = transformSync(file, read(file)).code;
  const names = new Set<string>();
  for (const { entries } of parseSync(file.replace(/\.tsx?$/, '.js'), js).module.staticExports) {
    for (const e of entries) {
      if (e.exportName.kind === 'Name' && e.exportName.name !== null && !e.isType) names.add(e.exportName.name);
      else if (e.importName.kind === 'AllButDefault' && e.exportName.kind === 'None' && e.moduleRequest) {
        const spec = e.moduleRequest.value;
        const target = isPathImport(spec) ? resolvePath(dirname(file), spec) : null;
        const inner = target ? runtimeExportsOf(target, read, seen) : null;
        if (!inner) return null;
        for (const n of inner) names.add(n);
      }
    }
  }
  return names;
}

/**
 * `code` with each `export * from` whose module `sourced` resolves the specifier to written out as the names that
 * module exports, so a bundle importing them through this module binds each by name. Rolldown 1.2 leaves such a
 * module's names out of a namespace object built over a module served from source, and a bundle reading a name
 * through that object gets `undefined`. A statement whose names cannot all be known is left as it was.
 */
export async function nameStarsOfSourced(
  file: string,
  code: string,
  sourced: (spec: string) => Promise<string | null>,
  namesOf: (file: string) => Set<string> | null = (f) => runtimeExportsOf(f),
): Promise<string | null> {
  if (!/\bexport\s*\*\s*from\b/.test(code)) return null;
  const edits: { start: number; end: number; text: string }[] = [];
  for (const { start, end, entries } of parseSync(file, code).module.staticExports) {
    const [e] = entries;
    if (entries.length !== 1 || !e || e.importName.kind !== 'AllButDefault' || e.exportName.kind !== 'None' || !e.moduleRequest) continue;
    const spec = e.moduleRequest.value;
    const target = await sourced(spec);
    const names = target ? namesOf(target) : null;
    if (!names) continue;
    edits.push({ start, end, text: names.size ? `export { ${[...names].sort().join(', ')} } from ${JSON.stringify(spec)};` : '' });
  }
  if (!edits.length) return null;
  let out = code;
  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, start) + text + out.slice(end);
  return out;
}

/** The rolldown plugin that applies {@link nameStarsOfSourced} to every bundled module. */
export function sourcedStarsNamed(sourced: () => ReadonlySet<string>) {
  return {
    name: 'weasel:prebundle-sourced-stars',
    async transform(this: { resolve(id: string, importer?: string): Promise<{ id: string } | null> }, code: string, id: string) {
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(id) || sourced().has(id)) return null;
      const out = await nameStarsOfSourced(id, code, async (spec) => {
        const resolved = await this.resolve(spec, id);
        return resolved && sourced().has(resolved.id) ? resolved.id : null;
      });
      return out === null ? null : { code: out, map: null };
    },
  };
}
