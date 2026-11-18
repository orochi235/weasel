import { DevtoolsLabel } from '@weasel-js/core';
import { type ReactNode, useContext } from 'react';
import { AnnotationsContext } from '../annotations/AnnotationsContext';
import { drawsDom } from '../chrome/builtins';
import { PaletteRegion } from '../chrome/regions/PaletteRegion';
import { SidebarRegion } from '../chrome/regions/SidebarRegion';
import { StatusRegion } from '../chrome/regions/StatusRegion';
import { TitleBarRegion } from '../chrome/regions/TitleBarRegion';
import { ToolbarRegion } from '../chrome/regions/ToolbarRegion';
import { ViewportRegion } from '../chrome/regions/ViewportRegion';
import type {
  ToolSlotContext,
  TrialChromeContext,
  TrialContribution,
  TrialRegion,
  TrialSidebar,
} from '../chrome/types';
import type { AutoReports } from '../config/autoReports';
import { useConfigSchema } from '../config/useConfigSchema';
import { useResolvedConfig } from '../config/useResolvedConfig';
import type { Instrument } from '../instrument/types';
import type { JobHandle } from '../job/types';
import { useLabCommands } from '../lab/LabContext';
import { type ChordTarget, useLabChords } from '../lab/labChords';
import { usePresentedTrial } from '../lab/presentation';
import { JobProgress } from '../primitives/JobProgress';
import { LabStoreContext } from '../state/context';
import type { TrialRecord } from '../state/types';
import { FloatSidebarContext } from './FloatSidebar';
import { TrialBody } from './TrialBody';
import type { TrialActions } from './TrialScope';
import { TrialTheme } from './TrialTheme';
import { TrialTitleBar } from './TrialTitleBar';
import { TrialTitleContext } from './trialTitle';
import { UndockedSections } from './UndockedSections';
import {
  type LoupeBindings,
  type UndoBindings,
  useTrialChromeContext,
} from './useTrialChromeContext';
import { useTrialContributions } from './useTrialContributions';
import { type TrialWritesOptions, useTrialWrites } from './useTrialWrites';

export type { LoupeBindings, UndoBindings } from './useTrialChromeContext';

/** How the lab dresses a trial's chrome, beyond what its instrument declares. */
export interface TrialChromeOptions {
  /** Contributions from the lab, merged last. */
  chrome?: readonly TrialContribution[];
  /** Built-in contribution ids to drop. Throws on an id that is not there. */
  suppress?: readonly string[];
  /** Contribution ids whose buttons to hide, keeping their keys. Throws on an id that is not there. */
  hide?: readonly string[];
  /** Where the sidebar sections go. Default `'dock'`. */
  sidebar?: TrialSidebar;
}

/** Props for `<TrialChrome>`. */
export interface TrialChromeProps extends TrialChromeOptions {
  trialId: string;
  record: TrialRecord;
  instrument: Instrument;
  isLastTrial: boolean;
  undoBindings?: UndoBindings;
  /** The trial's one config write, which `Trial` hands its instrument too.
   *  Omitted, a chrome mounted without a trial makes its own. */
  setConfig?: (path: string, value: unknown) => void;
  /** The trial's write of a value an edit is passing through, given with `setConfig`. */
  draftConfig?: (path: string, value: unknown) => void;
  /** What the instrument reported for its auto paths, which the settings panel quotes. */
  reported?: AutoReports;
  /** Supplied when the instrument declares a `job`. */
  job?: JobHandle;
  /** Supplied while a lens is mounted in the trial. The lens itself is the
   *  instrument's to mount; the chrome only offers the switch. */
  loupe?: LoupeBindings;
  /** Contributions the trial runtime itself adds — the drag palette and the
   *  layer list, which depend on runtime state the instrument cannot reach. */
  trialChrome?: readonly TrialContribution[];
  /** The trial's resolved tool slot, the setter that writes whichever slot it resolved to, and the live keys its
   *  instrument reported (`RenderContext.trial.setToolShortcuts`). `Trial` owns the resolution. */
  toolSlot?: ToolSlotContext;
  /** The trial's action registry, which `ctx.runAction` runs on. Omitted, `runAction` runs nothing. */
  actions?: TrialActions;
  children: ReactNode;
}

const NO_OP = (): void => {};
const NO_SLOT: ToolSlotContext = { activeToolId: null, setActiveTool: NO_OP };

/** The trial body's content class: flush for an instrument that draws its own canvas or stage. */
const contentClassOf = (instrument: Instrument, presented: boolean): string | undefined =>
  [drawsDom(instrument) ? '' : 'lk-trial__content--flush', presented ? 'lk-trial__stage' : '']
    .filter(Boolean)
    .join(' ') || undefined;

/** The trial's writes, for chrome mounted without a `setConfig`: its marks end a gesture, as in the trial. */
function useChromeWrites(opts: Omit<TrialWritesOptions, 'marks' | 'mounted'>) {
  return useTrialWrites({ ...opts, marks: useContext(AnnotationsContext) });
}

/** A trial's Undo, Redo and snapshot keys. A chord is its button's: suppress the button and the chord goes with
 *  it; hide it and the chord stays. A presented trial has no chrome, so nothing the chrome's keys act on. */
function trialChords(
  presented: boolean,
  offered: readonly TrialContribution[],
  ctx: Pick<TrialChromeContext, 'canUndo' | 'canRedo' | 'undo' | 'redo' | 'saveSnapshot'>,
): ChordTarget {
  return {
    can: (chord) =>
      !presented &&
      offered.some((c) => c.id === chord) &&
      (chord === 'snapshot' || (chord === 'undo' ? ctx.canUndo : ctx.canRedo)),
    run: (chord) => {
      if (chord === 'snapshot') ctx.saveSnapshot();
      else if (chord === 'redo') ctx.redo();
      else ctx.undo();
    },
  };
}

/** The frame around a running instrument. Builds one chrome context, assembles
 *  the contributions the instrument, the runtime and the lab declare, and hands
 *  each region its slice. Its Undo, Redo and snapshot chords are the lab's
 *  `lab.undo`, `lab.redo` and `lab.snapshot` actions, so it answers them under a `<Lab>`. */
export function TrialChrome({
  trialId,
  record,
  instrument,
  isLastTrial,
  undoBindings,
  setConfig: setConfigProp,
  draftConfig: draftConfigProp,
  reported,
  job,
  loupe,
  trialChrome,
  chrome,
  suppress,
  hide,
  sidebar = 'dock',
  toolSlot = NO_SLOT,
  actions,
  children,
}: TrialChromeProps) {
  const lab = useLabCommands();
  const { presented, ref: presentedRef } = usePresentedTrial(trialId);
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] TrialChrome requires <LabStoreProvider>');
  const { store } = storeCtx;

  const configSchema = useConfigSchema(instrument);
  const { config: settled, auto } = useResolvedConfig(configSchema, record.config, record.auto);
  const ownWrites = useChromeWrites({ store, trialId, instrument, schema: configSchema });
  const setConfig = setConfigProp ?? ownWrites.setConfig;
  const draftConfig = setConfigProp ? (draftConfigProp ?? setConfigProp) : ownWrites.draftConfig;

  const title = record.title ?? instrument.title ?? instrument.name;
  const ctx = useTrialChromeContext({
    trialId,
    record,
    lab,
    store,
    title,
    isLastTrial,
    undoBindings,
    loupe,
    toolSlot,
    actions,
    configSchema,
    auto,
    reported,
    setConfig,
    draftConfig,
  });

  const floating = sidebar === 'float';
  const { offered, shown } = useTrialContributions({
    instrument,
    ctx,
    marks: lab.marks,
    renderers: lab.renderers,
    trialChrome,
    chrome,
    suppress,
    hide,
    sidebar,
  });

  const inRegion = (region: TrialRegion): TrialContribution[] =>
    shown.filter((c) => c.region === region);
  const sections = inRegion('sidebar');
  const docked = <SidebarRegion key="docked" contributions={sections} ctx={ctx} />;
  const undocked = <Undocked key="undocked" sections={sections} ctx={ctx} />;

  useLabChords(trialId, trialChords(presented, offered, ctx));

  return (
    <section
      ref={presentedRef}
      className="lk-trial"
      data-trial-id={trialId}
      data-focused={!isLastTrial && lab.focusedTrialId === trialId ? 'true' : undefined}
      data-lk-presented={presented ? '' : undefined}
      aria-label={`Trial ${title}`}
      tabIndex={-1}
    >
      <FloatSidebarContext.Provider value={floating ? { title, sections: docked } : null}>
        <TrialTitleBar
          title={title}
          titleContent={instrument.renderTitle?.(title, { config: settled })}
          lead={<TitleBarRegion placement="lead" contributions={inRegion('titlebar')} ctx={ctx} />}
        >
          <TitleBarRegion contributions={inRegion('titlebar')} ctx={ctx} />
        </TrialTitleBar>
      </FloatSidebarContext.Provider>
      <div className="lk-trial__toolbar">
        <ToolbarRegion contributions={inRegion('toolbar')} ctx={ctx} />
      </div>
      <div className="lk-trial__body">
        <PaletteRegion contributions={inRegion('palette')} ctx={ctx} />
        <TrialBody
          width={record.sidebarWidth}
          onWidthChange={(w) => store.getState().updateTrialSidebarWidth(trialId, w)}
          contentClassName={contentClassOf(instrument, presented)}
          sidebar={floating || sections.length === 0 ? null : [docked, undocked]}
        >
          <TrialTheme mode={drawsDom(instrument) ? (record.colorMode ?? 'auto') : null}>
            <Titled title={title}>{children}</Titled>
          </TrialTheme>
          <ViewportRegion contributions={inRegion('viewport')} ctx={ctx} />
          {floating ? undocked : null}
        </TrialBody>
      </div>
      <TrialStatus job={job} contributions={inRegion('status')} ctx={ctx} />
    </section>
  );
}

/** The strip along a trial's foot: its job's progress, then the status readouts. */
function TrialStatus({
  job,
  contributions,
  ctx,
}: {
  job: JobHandle | undefined;
  contributions: TrialContribution[];
  ctx: TrialChromeContext;
}) {
  return (
    <div className="lk-trial__status">
      {job ? <JobProgress job={job} /> : null}
      <StatusRegion className="lk-trial__readouts" contributions={contributions} ctx={ctx} />
    </div>
  );
}

/** The sidebar sections torn out into the workspace, which the trial goes on rendering wherever the rest are. */
function Undocked({ sections, ctx }: { sections: TrialContribution[]; ctx: TrialChromeContext }) {
  return (
    <UndockedSections
      trialId={ctx.trialId}
      sections={sections.filter((c) => ctx.undockedPanels.includes(c.id))}
      onDock={ctx.dockPanel}
    />
  );
}

/** The trial's title, to what it renders and to a devtools panel listing its canvases. */
function Titled({ title, children }: { title: string; children: ReactNode }) {
  return (
    <TrialTitleContext.Provider value={title}>
      <DevtoolsLabel value={title}>{children}</DevtoolsLabel>
    </TrialTitleContext.Provider>
  );
}
