import './cssVars.css';
import {
  Input,
  type LabContribution,
  ToggleBar,
  type ToggleBarItem,
  refitScale,
  type TokenCategory,
  TokenPanel,
  type TokenScale,
  type TokenScaleRule,
  TrialIdContext,
  useLabContext,
  usePersistedState,
  useTrialId,
} from '@weasel-js/labkit';
import { THEME_SOURCES, TOKEN_MANIFEST } from '@weasel-js/theme';
import { scale as generateScale, type ThemeApi } from '@weasel-js/theme/engine';
import { historyKey } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '../../icons.gen';
import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { Globals } from '../../protocol/messages';
import { effectiveGlobals, GLOBALS_KEY } from '../globals';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { useTrialFrame } from '../trialFrames';
import { useCssOverrides } from './overrides';
import { type ShowToken, useRevealToken } from './reveal';
import { SectionJump } from './SectionJump';
import { THEME_NAME, type ThemeSave, TOKEN_PREFIX, type UnsavedScale, useThemeSave } from './useThemeSave';
import { useStoryTokens } from './useStoryTokens';
import { useThemeTokens } from './useThemeTokens';
import { useVarsHistory, type VarsState } from './varsHistory';

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
const SCALE_SOURCES: readonly ScaleSource[] = Object.entries(THEME_SOURCES[THEME_NAME]?.scales ?? {}).flatMap(([name, def]) => {
  if (!Array.isArray(def.steps)) return [];
  const steps = def.steps as readonly string[];
  const tokens = steps.map((step) => `${TOKEN_PREFIX}${name}-${step}`);
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

/**
 * The edited scales a save writes. A scale is saved only while every one of its steps still holds what its edit
 * generated: a step edited by hand after the scale is an override the scale has no place for.
 */
function unsavedScales(edited: Readonly<Record<string, TokenScale>>, overrides: Readonly<Record<string, string>>): UnsavedScale[] {
  return SCALE_SOURCES.flatMap((source): UnsavedScale[] => {
    const edit = edited[source.group];
    if (!edit || !source.tokens.some((name) => overrides[name] !== undefined)) return [];
    const { name, group, tokens } = source;
    const clean = scaleValues(source, edit).every(([token, value]) => overrides[token] === value);
    return clean ? [{ name, group, tokens, edit: { base: edit.base, rule: edit.rule } }] : [];
  });
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
 * reports. A scale edit, and a token the theme writes out, can be saved into the theme's definition file.
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
  const [edited, setEdited] = usePersistedState<Readonly<Record<string, TokenScale>>>('fg-css-vars-scales', {}, { scope: 'trial' });
  const [tab, setTab] = useState<Tab>('theme');
  const [filter, setFilter] = useState('');

  const themeTokens = useThemeTokens(globals, frame.vars);
  const story = useStoryTokens(frame.vars);
  const tokens = tab === 'theme' ? themeTokens : story.tokens;
  const listRef = useRef<HTMLDivElement>(null);
  const byTab = useMemo(() => ({ theme: themeTokens, story: story.tokens }), [themeTokens, story.tokens]);
  const show = useCallback<ShowToken>((name, at, category) => {
    setTab(at);
    setFilter((was) => (name.toLowerCase().includes(was.trim().toLowerCase()) ? was : ''));
    setFolds((prev) => (prev[category] ? { ...prev, [category]: false } : prev));
  }, [setFolds]);
  useRevealToken(listRef, byTab, show);

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
  const state = useMemo<VarsState>(() => ({ overrides, scales: edited }), [overrides, edited]);
  const history = useVarsHistory(state, (from, to) => {
    setOverrides(to.overrides);
    setEdited(to.scales);
    for (const name of new Set([...Object.keys(from.overrides), ...Object.keys(to.overrides)])) {
      if (from.overrides[name] !== to.overrides[name]) send?.({ type: 'vars.set', name, value: to.overrides[name] ?? null });
    }
  });
  const write = (name: string, value: string | null) => {
    const now = history.current();
    const { [name]: _dropped, ...rest } = now.overrides;
    history.commit({ ...now, overrides: value === null ? rest : { ...rest, [name]: value } }, `token:${name}`);
  };
  const onScaleChange = (group: string, next: TokenScale) => {
    const source = SCALE_SOURCES.find((sc) => sc.group === group);
    if (!source) return;
    const now = history.current();
    history.commit(
      { overrides: { ...now.overrides, ...Object.fromEntries(scaleValues(source, next)) }, scales: { ...now.scales, [group]: next } },
      `scale:${group}`,
    );
  };

  const unsaved = useMemo(() => unsavedScales(edited, overrides), [edited, overrides]);
  const { pending, saving, notice, save } = useThemeSave({ trialId, globals, themeApi, scales: unsaved, overrides, history });
  const onCollapsedChange = useCallback(
    (category: TokenCategory, collapsed: boolean) => setFolds((prev) => ({ ...prev, [category]: collapsed })),
    [setFolds],
  );

  return (
    // Capture: React Aria's fields stop a keydown from bubbling past them.
    <div
      className="fg-css-vars"
      onKeyDownCapture={(e) => {
        // The filter's text has its own undo.
        const to = (e.target as HTMLElement).closest('.fg-css-vars__filter') ? null : historyKey(e);
        if (!to) return;
        e.preventDefault();
        history.step(to);
      }}
    >
      <div className="fg-css-vars__controls">
        <div className="fg-css-vars__bar">
          <ToggleBar
            ariaLabel="Variables"
            variant="flat"
            size="sm"
            items={TABS}
            value={tab}
            onChange={(next) => {
              if (next) setTab(next);
            }}
          />
          <Input
            className="fg-css-vars__filter"
            aria-label="Filter"
            placeholder="Filter"
            value={filter}
            onChange={setFilter}
            leadingAdornment={<Icon name={icon('ui:search')} size={12} />}
          />
          <div className="fg-css-vars__steps" role="group" aria-label="History">
            <Button iconOnly ariaLabel="Undo" variant="ghost" size="sm" disabled={!history.canUndo} onClick={() => history.step('undo')}>
              <Icon name={icon('core:undo')} size={14} />
            </Button>
            <Button iconOnly ariaLabel="Redo" variant="ghost" size="sm" disabled={!history.canRedo} onClick={() => history.step('redo')}>
              <Icon name={icon('core:redo')} size={14} />
            </Button>
          </div>
        </div>
        {tab === 'story' ? (
          <Checkbox className="fg-css-vars__unused" isSelected={story.showUnused} onChange={story.setShowUnused}>
            Show variables the story doesn’t use
          </Checkbox>
        ) : null}
        {tab === 'theme' ? <SaveRow pending={pending} saving={saving} notice={notice} onSave={() => void save()} /> : null}
      </div>
      {shown.length === 0 ? (
        <p className="fg-css-vars__empty">
          {tokens.length > 0 ? 'No variables match.' : tab === 'story' ? story.emptyText : 'The story’s frame has reported no variables.'}
        </p>
      ) : (
        <div ref={listRef} className="fg-css-vars__list">
          <TokenPanel
            tokens={shown}
            namePrefix={TOKEN_PREFIX}
            onChange={write}
            scales={scales}
            onScaleChange={onScaleChange}
            collapsed={folds}
            onCollapsedChange={onCollapsedChange}
          />
        </div>
      )}
    </div>
  );
}

interface SaveRowProps extends Pick<ThemeSave, 'pending' | 'saving' | 'notice'> {
  readonly onSave: () => void;
}

/** The Save to theme button while there is something to save, and what the last save said. */
function SaveRow({ pending, saving, notice, onSave }: SaveRowProps) {
  if (!pending && !notice) return null;
  return (
    <div className="fg-css-vars__save">
      {pending ? (
        <Button variant="primary" size="sm" loading={saving} disabled={saving} onClick={onSave}>
          Save to theme
        </Button>
      ) : null}
      {notice ? (
        <p className={`fg-css-vars__notice fg-css-vars__notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      ) : null}
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
  item: { title: 'CSS Vars', actions: <SectionJump />, fill: true, body: <FocusedCssVars /> },
};
