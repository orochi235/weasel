import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Relative on purpose: vite loads its config in Node, where the aliases don't apply and the package's exports name a dist that may predate this code.
import { enumerateSelections } from '../../../packages/theme/src/axes';
import type { ThemeDefinition } from '../../../packages/theme/src/definition';
import { derive, generateTokens, mergeChain } from '../../../packages/theme/src/engine';
import { serializeDefinition, type IssueReport, type PutResult, type StoredTheme } from '../src/theme/store';

const NAME = /^[a-z][a-z0-9-]*$/;

export interface ThemeStoreOptions {
  /** Emitted into `generatedDir`. A new theme is created here. */
  readonly themesDir: string;
  /** Known definitions outside `themesDir`: saved, never emitted. */
  readonly extraFiles: readonly string[];
  readonly generatedDir: string;
}

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

export function createThemeStore(options: ThemeStoreOptions): ThemeStore {
  const entries = (): Entry[] => {
    const files = [
      ...readdirSync(options.themesDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => ({ file: resolve(options.themesDir, f), emits: true })),
      ...options.extraFiles.filter((f) => existsSync(f)).map((file) => ({ file, emits: false })),
    ];
    return files.map(({ file, emits }) => {
      const text = readFileSync(file, 'utf8');
      const definition = JSON.parse(text) as ThemeDefinition;
      return { file, theme: { name: definition.name, hash: hashOf(text), emits, definition } };
    });
  };

  const regenerate = (all: readonly Entry[]): { regenerated: boolean; problems: string[] } => {
    try {
      const result = generateTokens(all.filter((e) => e.theme.emits).map((e) => e.theme.definition));
      if (!result.ok) return { regenerated: false, problems: [...result.problems] };
      mkdirSync(options.generatedDir, { recursive: true });
      for (const [file, text] of Object.entries(result.files)) {
        const path = resolve(options.generatedDir, file);
        if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text);
      }
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

      const text = serializeDefinition(definition);
      writeFileSync(file, text);

      const all = entries();
      const byName = new Map(all.map((e) => [e.theme.name, e.theme.definition]));
      const lookup = (n: string) => byName.get(n);
      const issues: IssueReport[] = [];
      try {
        for (const selection of enumerateSelections(mergeChain(definition, lookup).axes ?? {})) {
          for (const issue of derive(definition, selection, lookup).issues) issues.push({ selection, issue });
        }
      } catch (e) {
        issues.push({ selection: {}, issue: { kind: 'invalid', path: name, message: (e as Error).message } });
      }

      const generated = emits ? regenerate(all) : { regenerated: false, problems: [] };
      return { status: 'saved', hash: hashOf(text), issues, ...generated };
    },
  };
}
