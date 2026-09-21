import {
  Input,
  inferTokenType,
  type LabContribution,
  ToggleBar,
  type ToggleBarItem,
  refitScale,
  type TokenCategory,
  type TokenEntry,
  TokenPanel,
  type TokenScale,
  type TokenScaleRule,
  TrialIdContext,
  useLabContext,
  usePersistedState,
  useTrialId,
} from '@weasel-js/labkit';
import { THEME_SOURCES, TOKEN_MANIFEST } from '@weasel-js/theme';
import { scale as generateScale } from '@weasel-js/theme/engine';
import { useCallback, useMemo, useState } from 'react';
import { useCssOverrides } from './overrides';
import { useTrialFrame } from '../trialFrames';

type Tab = 'theme' | 'story';

const TABS: readonly ToggleBarItem<Tab>[] = [
  { value: 'theme', label: 'Theme' },
  { value: 'story', label: 'Story' },
];

const MANIFEST = new Map(TOKEN_MANIFEST.map((token) => [token.name, token]));

interface ScaleSource {
  readonly name: string;
  readonly group: string;
  readonly steps: readonly string[];
  readonly tokens: readonly string[];
  /** The definition's rule, or its kind alone when a parameter is a reference or varies by axis. */
  readonly rule: TokenScaleRule | TokenScaleRule['kind'];
}

const literal = (v: unknown): v is number => typeof v === 'number';

/** The weasel theme's scales, as the panel can regenerate them. */
const SCALE_SOURCES: readonly ScaleSource[] = Object.entries(THEME_SOURCES.weasel?.scales ?? {}).flatMap(([name, def]) => {
  if (!Array.isArray(def.steps)) return [];
  const steps = def.steps as readonly string[];
  const tokens = steps.map((step) => `--wzl-${name}-${step}`);
  const group = MANIFEST.get(tokens[0] ?? '')?.group;
  if (!group) return [];
  const factors = Array.isArray(def.factors) && def.factors.every(literal) ? (def.factors as number[]) : null;
  const rule: ScaleSource['rule'] =
    def.factors !== undefined
      ? factors
        ? { kind: 'factors', factors }
        : 'factors'
      : def.ratio !== undefined
        ? literal(def.ratio)
          ? { kind: 'ratio', ratio: def.ratio }
          : 'ratio'
        : literal(def.step)
          ? { kind: 'step', step: def.step }
          : 'step';
  return [{ name, group, steps, tokens, rule }];
});

/** A scale as its steps stand: the definition's rule, with the base read back from the values the frame reports. */
function standingScale(source: ScaleSource, amounts: readonly number[]): TokenScale {
  const seed: TokenScale = { tokens: source.tokens, base: amounts[0] ?? 0, rule: { kind: 'step', step: 0 } };
  if (typeof source.rule === 'string') return refitScale(seed, source.rule, amounts);
  const { rule } = source;
  if (rule.kind !== 'factors') return { ...seed, rule };
  // The step nearest ×1 carries the least rounding back into the base.
  let at = 0;
  rule.factors.forEach((f, i) => {
    if (Math.abs(f - 1) < Math.abs((rule.factors[at] ?? 1) - 1)) at = i;
  });
  const base = (amounts[at] ?? 0) / (rule.factors[at] ?? 1);
  return { ...seed, base: Math.round(base * 100) / 100, rule };
}

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
  const [edited, setEdited] = usePersistedState<Record<string, TokenScale>>('fg-css-vars-scales', {}, { scope: 'lab' });
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

  const scales = useMemo(() => {
    if (tab !== 'theme') return undefined;
    const values = new Map(shown.map((t) => [t.name, t.value]));
    const out: Record<string, TokenScale> = {};
    for (const source of SCALE_SOURCES) {
      const amounts = source.tokens.map((name) => Number.parseFloat(values.get(name) ?? ''));
      if (amounts.some(Number.isNaN)) continue;
      const own = source.tokens.some((name) => overrides[name] !== undefined) ? edited[source.group] : undefined;
      out[source.group] = own ?? standingScale(source, amounts);
    }
    return out;
  }, [tab, shown, overrides, edited]);

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
  const onScaleChange = useCallback(
    (group: string, next: TokenScale) => {
      const source = SCALE_SOURCES.find((sc) => sc.group === group);
      if (!source) return;
      setEdited((prev) => ({ ...prev, [group]: next }));
      const { rule } = next;
      const values = generateScale(source.steps, {
        base: next.base,
        ...(rule.kind === 'factors' ? { factors: rule.factors } : rule.kind === 'ratio' ? { ratio: rule.ratio } : { step: rule.step }),
      });
      source.steps.forEach((step, i) => {
        const value = values[step];
        const name = source.tokens[i];
        if (value !== undefined && name !== undefined) write(name, value);
      });
    },
    [setEdited, write],
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
        <TokenPanel
          tokens={shown}
          onChange={write}
          scales={scales}
          onScaleChange={onScaleChange}
          collapsed={folds}
          onCollapsedChange={onCollapsedChange}
        />
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
