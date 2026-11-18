import './cssVars.css';
import {
  Input,
  type LabContribution,
  SegmentedBar,
  type SegmentedBarItem,
  type TokenCategory,
  TokenPanel,
  TrialIdContext,
  useLabContext,
  usePersistedState,
  useTrialId,
} from '@weasel-js/labkit';
import type { ThemeApi } from '@weasel-js/theme/engine';
import { historyKey } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '../../icons.gen';
import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { getOwn } from '@weasel-js/registry';
import type { StoryGlobals } from '../../protocol/messages';
import { effectiveGlobals, GLOBALS_KEY } from '../globals';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { useTrialFrame } from '../trialFrames';
import { type ShowToken, useRevealToken } from './reveal';
import { SectionJump } from './SectionJump';
import { scalesFor, unsavedScales } from './themeScales';
import { type ThemeSave, TOKEN_PREFIX, useThemeSave } from './useThemeSave';
import { useStoryTokens } from './useStoryTokens';
import { useThemeTokens } from './useThemeTokens';
import type { VarsHistory } from './varsHistory';
import { useVarsEdits } from './useVarsEdits';

type Tab = 'theme' | 'story';

const TABS: readonly SegmentedBarItem<Tab>[] = [
  { value: 'theme', label: 'Theme' },
  { value: 'story', label: 'Story' },
];

export interface CssVarsPanelProps {
  /** The globals the trial renders under, which pick the axis values a save writes into. */
  readonly globals?: StoryGlobals;
  /** Where a save goes. Defaults to the dev server's theme store. */
  readonly themeApi?: ThemeApi;
}

const NO_GLOBALS: StoryGlobals = {};

/**
 * Shows and overrides the CSS variables of the trial it is rendered inside: the theme's tokens, or what its frame
 * reports. A scale edit, and a token the theme writes out, can be saved into the theme's definition file.
 */
export function CssVarsPanel({ globals = NO_GLOBALS, themeApi }: CssVarsPanelProps = {}) {
  const trialId = useTrialId();
  const frame = useTrialFrame(trialId);
  const { overrides, edited, history, write, editScale } = useVarsEdits(frame.send);
  const [folds, setFolds] = usePersistedState<Partial<Record<TokenCategory, boolean>>>(
    'fg-css-vars-folds',
    {},
    { scope: 'lab' },
  );
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
  useRevealToken(listRef, byTab, show, frame.vars.length > 0);

  const query = filter.trim().toLowerCase();
  const shown = tokens
    .map((token) => {
      const override = getOwn(overrides, token.name);
      return override === undefined ? token : { ...token, value: override, overridden: true };
    })
    .filter((token) => !query || token.name.toLowerCase().includes(query) || token.value.toLowerCase().includes(query));

  const scales = useMemo(
    () => (tab === 'theme' ? scalesFor(new Map(shown.map((t) => [t.name, t.value])), overrides, edited) : undefined),
    [tab, shown, overrides, edited],
  );

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
        <VarsBar tab={tab} onTab={setTab} filter={filter} onFilter={setFilter} history={history} />
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
            onScaleChange={editScale}
            collapsed={folds}
            onCollapsedChange={onCollapsedChange}
          />
        </div>
      )}
    </div>
  );
}

interface VarsBarProps {
  readonly tab: Tab;
  readonly onTab: (tab: Tab) => void;
  readonly filter: string;
  readonly onFilter: (filter: string) => void;
  readonly history: Pick<VarsHistory, 'step' | 'canUndo' | 'canRedo'>;
}

/** The tab switch, the filter, and the undo and redo buttons. */
function VarsBar({ tab, onTab, filter, onFilter, history }: VarsBarProps) {
  return (
    <div className="fg-css-vars__bar">
      <SegmentedBar
        aria-label="Variables"
        variant="flat"
        size="sm"
        items={TABS}
        value={tab}
        onChange={(next) => {
          if (next) onTab(next);
        }}
      />
      <Input
        className="fg-css-vars__filter"
        aria-label="Filter"
        placeholder="Filter"
        value={filter}
        onChange={onFilter}
        leadingAdornment={<Icon name={icon('ui:search')} size={12} />}
      />
      <div className="fg-css-vars__steps" role="group" aria-label="History">
        <Button iconOnly aria-label="Undo" variant="ghost" size="sm" disabled={!history.canUndo} onClick={() => history.step('undo')}>
          <Icon name={icon('core:undo')} size={14} />
        </Button>
        <Button iconOnly aria-label="Redo" variant="ghost" size="sm" disabled={!history.canRedo} onClick={() => history.step('redo')}>
          <Icon name={icon('core:redo')} size={14} />
        </Button>
      </div>
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
        <Button stance="confirm" size="sm" loading={saving} disabled={saving} onClick={onSave}>
          Save to theme
        </Button>
      ) : null}
      {notice ? (
        <p className={`fg-css-vars__notice fg-css-vars__notice--${notice.outcome}`} role={notice.outcome === 'error' ? 'alert' : 'status'}>
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
