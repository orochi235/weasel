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
import { scale as generateScale, httpThemeApi, type ThemeApi } from '@weasel-js/theme/engine';
import { Button } from '@weasel-js/ui';
import { useCallback, useContext, useMemo, useState } from 'react';
import type { Globals } from '../../protocol/messages';
import { effectiveGlobals, GLOBALS_KEY } from '../globals';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { useTrialFrame } from '../trialFrames';
import { useCssOverrides } from './overrides';
import { applyScaleEdits, type ScaleEdit, selectionFor } from './saveScales';

type Tab = 'theme' | 'story';

const TABS: readonly ToggleBarItem<Tab>[] = [
  { value: 'theme', label: 'Theme' },
  { value: 'story', label: 'Story' },
];

const MANIFEST = new Map(TOKEN_MANIFEST.map((token) => [token.name, token]));

const THEME_NAME = 'weasel';

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
const SCALE_SOURCES: readonly ScaleSource[] = Object.entries(THEME_SOURCES[THEME_NAME]?.scales ?? {}).flatMap(([name, def]) => {
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

/** Each of a scale's tokens and the value `next` gives it. */
function scaleValues(source: ScaleSource, next: TokenScale): [string, string][] {
  const { rule } = next;
  const values = generateScale(source.steps, {
    base: next.base,
    ...(rule.kind === 'factors' ? { factors: rule.factors } : rule.kind === 'ratio' ? { ratio: rule.ratio } : { step: rule.step }),
  });
  return source.steps.flatMap((step, i) => {
    const value = values[step];
    const name = source.tokens[i];
    return value !== undefined && name !== undefined ? [[name, value]] : [];
  });
}

type Notice = { readonly trialId: string | null; readonly tone: 'saved' | 'error'; readonly text: string };

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

export interface CssVarsPanelProps {
  /** The globals the trial renders under, which pick the axis values a save writes into. */
  readonly globals?: Globals;
  /** Where a save goes. Defaults to the dev server's theme store. */
  readonly themeApi?: ThemeApi;
}

const NO_GLOBALS: Globals = {};

/**
 * Shows and overrides the CSS variables of the trial it is rendered inside: the theme's tokens, or what its frame
 * reports. Scale edits can be saved into the theme's definition file.
 */
export function CssVarsPanel({ globals = NO_GLOBALS, themeApi }: CssVarsPanelProps = {}) {
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
      for (const [name, value] of scaleValues(source, next)) write(name, value);
    },
    [setEdited, write],
  );

  // A scale is saved only while every one of its steps still holds what its edit generated: a step edited by hand
  // after the scale is an override the definition has no place for.
  const unsaved = useMemo(
    () =>
      SCALE_SOURCES.flatMap((source) => {
        const edit = edited[source.group];
        if (!edit || !source.tokens.some((name) => overrides[name] !== undefined)) return [];
        const values = scaleValues(source, edit);
        return values.every(([name, value]) => overrides[name] === value) ? [{ source, edit }] : [];
      }),
    [edited, overrides],
  );
  const [saving, setSaving] = useState(false);
  const [held, setHeld] = useState<Notice | null>(null);
  const notice = held?.trialId === trialId ? held : null;
  const setNotice = (next: Omit<Notice, 'trialId'> | null) => setHeld(next && { ...next, trialId });
  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const api = themeApi ?? httpThemeApi();
      const stored = await api.get(THEME_NAME);
      const file = `themes/${THEME_NAME}.json`;
      if (JSON.stringify(stored.definition) !== JSON.stringify(THEME_SOURCES[THEME_NAME])) {
        setNotice({ tone: 'error', text: `${file} has changed since this page loaded. Reload to edit against it.` });
        return;
      }
      const edits: Record<string, ScaleEdit> = Object.fromEntries(
        unsaved.map(({ source, edit }) => [source.name, { base: edit.base, rule: edit.rule }]),
      );
      const next = applyScaleEdits(stored.definition, edits, selectionFor(stored.definition.axes ?? {}, globals));
      if (!next.ok) {
        setNotice({ tone: 'error', text: next.message });
        return;
      }
      const result = await api.put(THEME_NAME, next.definition, stored.hash);
      if (result.status === 'conflict') {
        setNotice({ tone: 'error', text: `${file} changed on disk while saving. Nothing was written; reload to edit against it.` });
        return;
      }
      if (result.status === 'invalid') {
        setNotice({ tone: 'error', text: result.message });
        return;
      }
      for (const { source } of unsaved) for (const name of source.tokens) write(name, null);
      const groups = new Set(unsaved.map(({ source }) => source.group));
      setEdited((prev) => Object.fromEntries(Object.entries(prev).filter(([group]) => !groups.has(group))));
      setNotice(
        result.regenerated || result.problems.length === 0
          ? { tone: 'saved', text: `Saved to ${file}.` }
          : { tone: 'error', text: `Saved to ${file}, but the tokens were not regenerated: ${result.problems.join('; ')}` },
      );
    } catch (e) {
      setNotice({ tone: 'error', text: `Saving needs forge's dev server, which did not answer: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  };
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
        {tab === 'theme' && (unsaved.length > 0 || notice) ? (
          <div className="fg-css-vars__save">
            {unsaved.length > 0 ? (
              <Button variant="primary" size="sm" loading={saving} disabled={saving} onClick={() => void save()}>
                Save scales to theme
              </Button>
            ) : null}
            {notice ? (
              <p
                className={`fg-css-vars__notice fg-css-vars__notice--${notice.tone}`}
                role={notice.tone === 'error' ? 'alert' : 'status'}
              >
                {notice.text}
              </p>
            ) : null}
          </div>
        ) : null}
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
  const labGlobals = useContext(StoryGlobalsContext);
  const record = trials.find((trial) => trial.id === focusedTrialId);
  if (!record) return null;
  const pins = (record.config as Record<string, unknown> | null | undefined)?.[GLOBALS_KEY];
  const instrument = instruments.find((i) => i.name === record.instrumentName);
  return (
    <section className="fg-css-vars-focus" aria-label="CSS Vars">
      <p className="fg-css-vars__trial">{record.title ?? instrument?.title ?? record.instrumentName}</p>
      <TrialIdContext.Provider value={record.id}>
        <CssVarsPanel globals={effectiveGlobals(labGlobals, pins)} />
      </TrialIdContext.Provider>
    </section>
  );
}

export const CSS_VARS_SECTION: LabContribution = {
  id: 'fg-css-vars',
  region: 'aside',
  item: { title: 'CSS Vars', body: <FocusedCssVars /> },
};
