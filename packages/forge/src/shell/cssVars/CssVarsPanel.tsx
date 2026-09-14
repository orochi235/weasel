import {
  Input,
  inferTokenType,
  type LabContribution,
  ToggleBar,
  type ToggleBarItem,
  type TokenCategory,
  type TokenEntry,
  TokenPanel,
  TrialIdContext,
  useLabContext,
  usePersistedState,
  useTrialId,
} from '@weasel-js/labkit';
import { TOKEN_MANIFEST } from '@weasel-js/theme';
import { useCallback, useMemo, useState } from 'react';
import { useCssOverrides } from './overrides';
import { useTrialFrame } from './trialFrames';

type Tab = 'theme' | 'story';

const TABS: readonly ToggleBarItem<Tab>[] = [
  { value: 'theme', label: 'Theme' },
  { value: 'story', label: 'Story' },
];

const MANIFEST = new Map(TOKEN_MANIFEST.map((token) => [token.name, token]));

/** A reported var's group: its name without the leading dashes or its last segment, which names the step. */
function groupOf(name: string): string {
  const segments = name.replace(/^--/, '').split('-');
  return segments.length > 1 ? segments.slice(0, -1).join('-') : name.replace(/^--/, '');
}

/** Shows and overrides the CSS variables of the trial it is rendered inside: the theme's tokens, or what its frame reports. */
export function CssVarsPanel() {
  const trialId = useTrialId();
  const frame = useTrialFrame(trialId);
  const [overrides, setOverrides] = useCssOverrides();
  const [folds, setFolds] = usePersistedState<Partial<Record<TokenCategory, boolean>>>(
    'fg-css-vars-folds',
    {},
    { scope: 'lab' },
  );
  const [tab, setTab] = useState<Tab>('theme');
  const [filter, setFilter] = useState('');

  const tokens = useMemo<TokenEntry[]>(() => {
    if (tab === 'story') {
      return frame.vars.map(({ name, value }) => {
        const known = MANIFEST.get(name);
        return { name, type: known?.type ?? inferTokenType(value), group: known?.group ?? groupOf(name), value };
      });
    }
    const reported = new Map(frame.vars.map((v) => [v.name, v.value]));
    return TOKEN_MANIFEST.map((token) => ({
      name: token.name,
      type: token.type,
      group: token.group,
      value: reported.get(token.name) ?? token.defaultValue,
      description: token.description,
    }));
  }, [tab, frame.vars]);

  const query = filter.trim().toLowerCase();
  const shown = tokens
    .map((token) => {
      const override = overrides[token.name];
      return override === undefined ? token : { ...token, value: override, overridden: true };
    })
    .filter((token) => !query || token.name.toLowerCase().includes(query) || token.value.toLowerCase().includes(query));

  const send = frame.send;
  const write = useCallback(
    (name: string, value: string | null) => {
      setOverrides((prev) => {
        const { [name]: _dropped, ...rest } = prev;
        return value === null ? rest : { ...rest, [name]: value };
      });
      send?.({ type: 'vars.set', name, value });
    },
    [setOverrides, send],
  );
  const onCollapsedChange = useCallback(
    (category: TokenCategory, collapsed: boolean) => setFolds((prev) => ({ ...prev, [category]: collapsed })),
    [setFolds],
  );

  return (
    <div className="fg-css-vars">
      <div className="fg-css-vars__controls">
        <ToggleBar
          ariaLabel="Variables"
          variant="flat"
          items={TABS}
          value={tab}
          onChange={(next) => {
            if (next) setTab(next);
          }}
        />
        <Input aria-label="Filter" placeholder="Filter by name or value" value={filter} onChange={setFilter} />
      </div>
      {shown.length === 0 ? (
        <p className="fg-css-vars__empty">
          {tokens.length === 0 ? 'The story’s frame has reported no variables.' : 'No variables match.'}
        </p>
      ) : (
        <TokenPanel tokens={shown} onChange={write} collapsed={folds} onCollapsedChange={onCollapsedChange} />
      )}
    </div>
  );
}

/** The panel for the lab's focused trial, rendered as though inside that trial. */
function FocusedCssVars() {
  const { focusedTrialId, trials, instruments } = useLabContext();
  const record = trials.find((trial) => trial.id === focusedTrialId);
  if (!record) return null;
  const instrument = instruments.find((i) => i.name === record.instrumentName);
  return (
    <section className="fg-css-vars-focus" aria-label="CSS Vars">
      <p className="fg-css-vars__trial">{record.title ?? instrument?.title ?? record.instrumentName}</p>
      <TrialIdContext.Provider value={record.id}>
        <CssVarsPanel />
      </TrialIdContext.Provider>
    </section>
  );
}

export const CSS_VARS_SECTION: LabContribution = {
  id: 'fg-css-vars',
  region: 'aside',
  item: { title: 'CSS Vars', body: <FocusedCssVars /> },
};
