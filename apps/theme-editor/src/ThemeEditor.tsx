import { LabShell } from '@weasel-js/labkit';
import { useCallback, useEffect, useState } from 'react';
import styles from './ThemeEditor.module.css';
import { ThemeWorkbench } from './ThemeWorkbench';
import { bundledThemeApi, httpThemeApi, type ThemeApi } from './theme/api';
import { clearDraft, loadDraft, loadLastTheme, persistLastTheme } from './theme/draftStorage';
import type { StoredTheme } from './theme/store';

interface Loaded {
  readonly api: ThemeApi;
  readonly themes: readonly StoredTheme[];
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
        if (live) setLoaded(next);
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
    clearDraft(current.name);
    replace(await loaded.api.get(current.name));
    setGeneration((g) => g + 1);
  };

  return (
    <ThemeWorkbench
      key={`${current.name}:${generation}`}
      api={loaded.api}
      themes={loaded.themes}
      stored={current}
      start={draft ?? { definition: current.definition, baseHash: current.hash }}
      onPick={(next) => {
        persistLastTheme(next);
        setName(next);
      }}
      onSaved={replace}
      onReload={reload}
    />
  );
}
