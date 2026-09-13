import {
  Button,
  ColorRow,
  PropertyList,
  TextRow,
  ToggleBar,
  type LabContribution,
  type ToggleBarItem,
  TrialIdContext,
  useLabContext,
  useTrialId,
} from '@weasel-js/labkit';
import { TOKEN_MANIFEST } from '@weasel-js/theme';
import { memo, useCallback, useMemo, useState } from 'react';
import { parsesAsColor, toHex } from './color';
import { useCssOverrides } from './overrides';
import { useTrialFrame } from './trialFrames';

type Tab = 'theme' | 'story';

const TABS: readonly ToggleBarItem<Tab>[] = [
  { value: 'theme', label: 'Theme' },
  { value: 'story', label: 'Story' },
];

interface VarRowProps {
  name: string;
  value: string;
  overridden: boolean;
  write: (name: string, value: string | null) => void;
}

const VarRow = memo(function VarRow({ name, value, overridden, write }: VarRowProps) {
  const hex = useMemo(() => (parsesAsColor(value) ? toHex(value) : null), [value]);
  const onChange = useCallback((next: string | null) => write(name, next), [write, name]);
  const reset = useCallback(() => write(name, null), [write, name]);
  return (
    <div className="fg-css-var" role="group" aria-label={name}>
      <PropertyList className="fg-css-var__rows" pack="one-up" density="tight">
        <TextRow label={name} value={value} onChange={onChange} />
        {hex ? <ColorRow label="Color" value={hex} onChange={onChange} /> : null}
      </PropertyList>
      {overridden ? (
        <Button variant="ghost" size="sm" ariaLabel={`Reset ${name}`} onClick={reset}>
          Reset
        </Button>
      ) : null}
    </div>
  );
});

/** Shows and overrides the CSS variables of the trial it is rendered inside: the theme's tokens, or what its frame reports. */
export function CssVarsPanel() {
  const trialId = useTrialId();
  const frame = useTrialFrame(trialId);
  const [overrides, setOverrides] = useCssOverrides();
  const [tab, setTab] = useState<Tab>('theme');
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    if (tab === 'story') return frame.vars.map(({ name, value }) => ({ name, value }));
    const reported = new Map(frame.vars.map((v) => [v.name, v.value]));
    return TOKEN_MANIFEST.map((token) => ({ name: token.name, value: reported.get(token.name) ?? token.defaultValue }));
  }, [tab, frame.vars]);

  const query = filter.trim().toLowerCase();
  const shown = rows
    .map((row) => ({ ...row, value: overrides[row.name] ?? row.value }))
    .filter((row) => !query || row.name.toLowerCase().includes(query) || row.value.toLowerCase().includes(query));

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

  return (
    <div className="fg-css-vars">
      <ToggleBar
        ariaLabel="Variables"
        size="sm"
        items={TABS}
        value={tab}
        onChange={(next) => {
          if (next) setTab(next);
        }}
      />
      <PropertyList pack="one-up" density="tight">
        <TextRow label="Filter" value={filter} placeholder="Name or value" onChange={setFilter} />
      </PropertyList>
      {shown.length === 0 ? (
        <p className="fg-css-vars__empty">
          {rows.length === 0 ? 'The story’s frame has reported no variables.' : 'No variables match.'}
        </p>
      ) : (
        <div className="fg-css-vars__list">
          {shown.map((row) => (
            <VarRow
              key={row.name}
              name={row.name}
              value={row.value}
              overridden={row.name in overrides}
              write={write}
            />
          ))}
        </div>
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
