import { Lab } from '@weasel-js/labkit';
import { openPrefsSync, prefValueAtPath, type PrefGroup, type PrefsStore } from '@weasel-js/prefs';
import { usePrefsValues } from '@weasel-js/prefs/react';
import { localStorageAdapter, type SyncStorageAdapter } from '@weasel-js/storage';
import {
  themeAxisPath,
  themeFromPrefs,
  themePrefsReferences,
  themePrefsSchema,
  themePrefsSelection,
  themePrefsValues,
} from '@weasel-js/theme/prefs';
import { weaselTheme, type Theme } from '@weasel-js/theme';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import { useMemo, useState } from 'react';
import { LABS, THEME_PREFS_LAB } from '../../shared/labs';
import { HistorySlot } from './HistorySlot';
import { ThemePreview } from './ThemePreview';
import { usePrefsHistory } from './usePrefsHistory';
import { tokenReferenceRenderer } from './TokenReference';
import styles from './ThemePrefs.module.css';

export interface ThemePrefsProps {
  /** The theme the schema is drawn from and the pins go over. Default `weaselTheme`. */
  readonly theme?: Theme;
  /** Where the store keeps what was set. Default the browser's local storage. */
  readonly storage?: SyncStorageAdapter;
}

const PREFIX = 'theme-prefs.';

/**
 * A theme as a preferences form: a page in the rail for each token group, a row per token, and a color that
 * differs by mode split into one member per mode. What is set is pinned over the theme, and the preview draws the
 * result.
 */
export function ThemePrefs({ theme = weaselTheme, storage = localStorageAdapter }: ThemePrefsProps) {
  const [store] = useState(() => openPrefsSync(themePrefsSchema(theme), { storage, prefix: PREFIX }) as PrefsStore<PrefGroup>);
  const { unset } = usePrefsValues(store);
  const { history, set, reset, setAt } = usePrefsHistory(store);
  const { values, scopes } = themePrefsValues(store, theme);
  const { mode: _mode, ...selection } = themePrefsSelection(store);
  const axis = themeAxisPath('');
  const tokens = (path: string): boolean => !path.startsWith(axis);
  // A reference followed to its token selects that token's row, which opens its page and brings it into view.
  const [opened, setOpened] = useState<readonly string[]>([]);
  const renderers = useMemo(
    () => ({ string: tokenReferenceRenderer(themePrefsReferences(store.schema), (path) => setOpened([path])) }),
    [store],
  );
  return (
    <Lab title="Theme prefs" pages={LABS} path={THEME_PREFS_LAB.href}>
      <HistorySlot history={history} />
      <div className={styles.layout}>
        <div className={styles.form}>
          <PrefsForm
            layout="rail"
            filterable
            schema={store.schema}
            values={values}
            scopes={scopes}
            onChange={set}
            onChangeAt={setAt}
            auto={new Set([...unset].filter(tokens))}
            canInherit={tokens}
            onAutoChange={(path, next) => (next ? reset(path) : set(path, prefValueAtPath(values, path)))}
            inheritHint={() => 'from theme'}
            renderers={renderers}
            selected={opened}
          />
        </div>
        <div className={styles.preview}>
          <ThemePreview variants={[{ label: 'Pinned', theme: themeFromPrefs(store, theme) }]} selection={selection} />
        </div>
      </div>
    </Lab>
  );
}
