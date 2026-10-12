import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Relative on purpose: vite loads its config in Node, where the aliases don't apply and the package's exports name a dist that may predate this code.
import { enumerateSelections } from '../packages/theme/src/axes.ts';
import type { ThemeDefinition } from '../packages/theme/src/definition.ts';
import { derive, generateTokens, mergeChain } from '../packages/theme/src/engine.ts';
import { serializeDefinition, type IssueReport, type PutResult, type StoredTheme } from '../packages/theme/src/store.ts';

const NAME = /^[a-z][a-z0-9-]*$/;

export interface ThemeStoreOptions {
  /** Emitted into `generatedDir`. A new theme is created here. */
  readonly themesDir: string;
  /** Known definitions outside `themesDir`: saved, never emitted. */
  readonly extraFiles: readonly string[];
  readonly generatedDir: string;
  /** Writes one file whole. Tests pass one that fails part-way. */
  readonly writeFile?: (path: string, text: string) => void;
}

/** This repo's definitions: the emitting themes, labkit's interstellar, and the desktop themes. */
export const repoThemeStoreOptions = (repoRoot: string): ThemeStoreOptions => ({
  themesDir: resolve(repoRoot, 'packages/theme/themes'),
  extraFiles: [
    resolve(repoRoot, 'packages/labkit/src/theme/interstellar.theme.json'),
    resolve(repoRoot, 'packages/theme/src/themes/win9x.theme.json'),
  ],
  generatedDir: resolve(repoRoot, 'packages/theme/src/generated'),
});

export interface ThemeStore {
  list(): StoredTheme[];
  read(name: string): StoredTheme | undefined;
  write(name: string, definition: ThemeDefinition, baseHash: string | null): PutResult;
}

interface Entry {
  readonly file: string;
  readonly theme: StoredTheme;
}

const hashOf = (text: string) => createHash('sha256').update(text).digest('hex');

/** Replace each file with its new text, or none of them: every text is written beside its file first, then moved over it. */
function replaceFiles(files: readonly (readonly [path: string, text: string])[], writeFile: (path: string, text: string) => void): void {
  const staged = files.map(([path, text]) => ({ path, text, temp: `${path}.${process.pid}.tmp` }));
  try {
    for (const { temp, text } of staged) writeFile(temp, text);
    for (const { temp, path } of staged) renameSync(temp, path);
  } finally {
    for (const { temp } of staged) rmSync(temp, { force: true });
  }
}

export function createThemeStore(options: ThemeStoreOptions): ThemeStore {
  const writeFile = options.writeFile ?? ((path: string, text: string) => writeFileSync(path, text));

  const entries = (): Entry[] => {
    const files = [
      ...readdirSync(options.themesDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => ({ file: resolve(options.themesDir, f), emits: true })),
      ...options.extraFiles.filter((f) => existsSync(f)).map((file) => ({ file, emits: false })),
    ];
    return files.flatMap(({ file, emits }): Entry[] => {
      const text = readFileSync(file, 'utf8');
      try {
        const definition = JSON.parse(text) as ThemeDefinition;
        return [{ file, theme: { name: definition.name, hash: hashOf(text), emits, definition } }];
      } catch (e) {
        // Every route reads every file, so one that does not parse is left out rather than failing them all.
        console.warn(`theme store: skipping ${file}, which is not JSON: ${(e as Error).message}`);
        return [];
      }
    });
  };

  const regenerate = (emitting: readonly ThemeDefinition[]): { regenerated: boolean; problems: string[] } => {
    try {
      const result = generateTokens(emitting);
      if (!result.ok) return { regenerated: false, problems: [...result.problems] };
      mkdirSync(options.generatedDir, { recursive: true });
      const changed = Object.entries(result.files)
        .map(([file, text]) => [resolve(options.generatedDir, file), text] as const)
        .filter(([path, text]) => !existsSync(path) || readFileSync(path, 'utf8') !== text);
      replaceFiles(changed, writeFile);
      return { regenerated: true, problems: [] };
    } catch (e) {
      return { regenerated: false, problems: [(e as Error).message] };
    }
  };

  return {
    list: () => entries().map((e) => e.theme),
    read: (name) => entries().find((e) => e.theme.name === name)?.theme,

    write(name, definition, baseHash) {
      if (!NAME.test(name)) return { status: 'invalid', message: `"${name}" is not a theme name` };
      if (definition?.name !== name) return { status: 'invalid', message: `the definition is named "${definition?.name}", not "${name}"` };

      const known = entries().find((e) => e.theme.name === name);
      const file = known?.file ?? resolve(options.themesDir, `${name}.json`);
      const emits = known?.theme.emits ?? true;
      const current = existsSync(file) ? hashOf(readFileSync(file, 'utf8')) : null;
      if (current !== baseHash) return { status: 'conflict', hash: current };

      const others = entries()
        .filter((e) => e.theme.name !== name)
        .map((e) => ({ definition: e.theme.definition, emits: e.theme.emits }));
      const set = [...others, { definition, emits }];
      const byName = new Map(set.map((t) => [t.definition.name, t.definition]));
      const lookup = (n: string) => byName.get(n);
      const emitting = set.filter((t) => t.emits).map((t) => t.definition);

      if (emits) {
        const roots = emitting.filter((d) => !d.extends);
        if (roots.length !== 1) {
          return { status: 'invalid', message: `the themes that emit need exactly one that extends nothing; saving would leave ${roots.length}` };
        }
        const orphan = emitting.find((d) => d.extends && !emitting.some((p) => p.name === d.extends));
        if (orphan) return { status: 'invalid', message: `"${orphan.name}" extends "${orphan.extends}", which is not a theme that emits` };
      } else if (definition.extends && !byName.has(definition.extends)) {
        return { status: 'invalid', message: `"${name}" extends "${definition.extends}", which is not a known theme` };
      }

      const issues: IssueReport[] = [];
      try {
        for (const selection of enumerateSelections(mergeChain(definition, lookup).axes ?? {})) {
          for (const issue of derive(definition, selection, lookup).issues) issues.push({ selection, issue });
        }
      } catch (e) {
        return { status: 'invalid', message: (e as Error).message };
      }

      const text = serializeDefinition(definition);
      replaceFiles([[file, text]], writeFile);
      const generated = emits ? regenerate(emitting) : { regenerated: false, problems: [] };
      return { status: 'saved', hash: hashOf(text), issues, ...generated };
    },
  };
}
