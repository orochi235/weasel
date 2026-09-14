import { LabShell } from '@weasel-js/labkit';
import { useCallback, useEffect, useState } from 'react';
import styles from './ThemeEditor.module.css';
import { ThemeWorkbench } from './ThemeWorkbench';
import { bundledThemeApi, httpThemeApi, type ThemeApi } from './theme/api';
import { clearDraft, draftNames, loadDraft, loadLastTheme, persistLastTheme } from './theme/draftStorage';
import { starterDefinition, themeNameProblem } from './theme/starter';
import type { StoredTheme } from './theme/store';

interface Loaded {
  readonly api: ThemeApi;
  readonly themes: readonly StoredTheme[];
  /** What the api listed. A theme outside it has no file yet; the bundled themes have no hash either, and are not new. */
  readonly listed: ReadonlySet<string>;
}

/** Themes the list lacks that have a draft: new themes, not yet saved. */
function withUnsavedDrafts(themes: readonly StoredTheme[]): StoredTheme[] {
  const unsaved = draftNames().flatMap((name): StoredTheme[] => {
    if (themes.some((t) => t.name === name)) return [];
    const definition = loadDraft(name)?.definition;
    return definition ? [{ name, hash: '', emits: true, definition }] : [];
  });
  return [...themes, ...unsaved];
}

export function ThemeEditor({ api }: { readonly api?: ThemeApi }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [name, setName] = useState<string | null>(loadLastTheme);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let live = true;
    const primary = api ?? httpThemeApi();
    primary
      .list()
      .then((themes) => ({ api: primary, themes }))
      .catch(async () => {
        const fallback = bundledThemeApi();
        return { api: fallback, themes: await fallback.list() };
      })
      .then((next) => {
        if (live) setLoaded({ api: next.api, themes: withUnsavedDrafts(next.themes), listed: new Set(next.themes.map((t) => t.name)) });
      });
    return () => {
      live = false;
    };
  }, [api]);

  const replace = useCallback(
    (theme: StoredTheme) => setLoaded((l) => l && { ...l, themes: l.themes.map((t) => (t.name === theme.name ? theme : t)) }),
    [],
  );

  if (!loaded) {
    return (
      <LabShell title="Theme editor">
        <p className={styles.loading}>Loading themes…</p>
      </LabShell>
    );
  }

  const current = loaded.themes.find((t) => t.name === name) ?? loaded.themes[0];
  const draft = loadDraft(current.name);
  const reload = async () => {
    const fresh = await loaded.api.get(current.name);
    clearDraft(current.name);
    replace(fresh);
    setGeneration((g) => g + 1);
  };
  const create = (newName: string): string | null => {
    const problem = themeNameProblem(newName, loaded.themes.map((t) => t.name));
    if (problem) return problem;
    const definition = starterDefinition(newName);
    setLoaded((l) => l && { ...l, themes: [...l.themes, { name: newName, hash: '', emits: true, definition }] });
    persistLastTheme(newName);
    setName(newName);
    return null;
  };
  const onDisk = current.hash !== '' || loaded.listed.has(current.name);

  return (
    <ThemeWorkbench
      key={`${current.name}:${generation}`}
      api={loaded.api}
      themes={loaded.themes}
      stored={current}
      start={draft ?? { definition: current.definition, baseHash: onDisk ? current.hash : null }}
      onPick={(next) => {
        persistLastTheme(next);
        setName(next);
      }}
      onSaved={replace}
      onReload={reload}
      onNew={create}
    />
  );
}
