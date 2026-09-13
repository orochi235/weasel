import { useContext, useMemo } from 'react';
import { useStore } from 'zustand/react';
import { useLabContext } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import { usePersistedState } from '../state/usePersistedState';
import { resolveLabTool } from '../tools/labTool';
import type { TrialTool } from '../tools/types';
import type { LabChromeContext, LabContribution, LabRegion } from './labTypes';
import { mergeContributions } from './merge';
import { SidebarRegion } from './regions/SidebarRegion';
import { StatusRegion } from './regions/StatusRegion';
import { ToolbarRegion } from './regions/ToolbarRegion';

/** The lab's chrome context: the lab itself, plus the lab's tool slot. Throws
 *  outside a `<Lab>`. */
export function useLabChromeContext(): LabChromeContext {
  const lab = useLabContext();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] lab chrome requires <LabStoreProvider>');
  const slot = useStore(storeCtx.store, (s) => s.activeToolId);
  const storeInstruments = useStore(storeCtx.store, (s) => s.instruments);
  const activeToolId = resolveLabTool(slot, storeInstruments ?? lab.instruments);
  const setLabTool = useStore(storeCtx.store, (s) => s.setLabTool);
  return useMemo(
    () => ({ ...lab, activeToolId, setActiveTool: setLabTool }),
    [lab, activeToolId, setLabTool],
  );
}

/** The lab's contributions for one region, in declaration order. */
export function contributionsIn<TCtx = LabChromeContext>(
  contributions: readonly LabContribution<TCtx>[],
  region: LabRegion,
): LabContribution<TCtx>[] {
  return contributions.filter((c) => c.region === region);
}

/** The palette contributions a lab's `tools` stand for. Declaring a tool is
 *  shorthand for contributing a palette item that writes the lab's tool
 *  slot. */
export function toolContributions(tools: readonly TrialTool[]): LabContribution[] {
  return tools.map((t) => ({
    id: t.id,
    region: 'palette' as const,
    ...(t.group === undefined ? {} : { group: t.group }),
    item: {
      icon: t.icon,
      label: t.label,
      ...(t.shortcut === undefined ? {} : { shortcut: t.shortcut }),
    },
  }));
}

/** Everything the lab's chrome renders, from both of the ways a lab declares
 *  it. Tools and contributions share one id namespace, so a tool colliding
 *  with a contribution throws here rather than one of them silently losing. */
export function labContributions(
  tools: readonly TrialTool[] | undefined,
  chrome: readonly LabContribution[] | undefined,
): LabContribution[] {
  return mergeContributions<LabContribution>(toolContributions(tools ?? []), [...(chrome ?? [])]);
}

/** Props shared by the lab's region mounts. Each takes the lab's whole
 *  contribution list and lays out the part addressed to it. */
export interface LabRegionProps {
  contributions: readonly LabContribution[];
}

/** The lab's action bar, in the shell header beside the title. */
export function LabHeaderRegion({ contributions }: LabRegionProps) {
  const ctx = useLabChromeContext();
  return (
    <ToolbarRegion
      region="header"
      label="Lab actions"
      contributions={contributionsIn(contributions, 'header')}
      ctx={ctx}
    />
  );
}

function LabSections({ contributions, region }: LabRegionProps & { region: 'sidebar' | 'aside' }) {
  const lab = useLabChromeContext();
  const [collapsedSections, setFolds] = usePersistedState<Record<string, boolean>>(
    `lk-lab-${region}-folds`,
    {},
    { scope: 'lab' },
  );
  const ctx = useMemo(
    () => ({
      ...lab,
      collapsedSections,
      setSectionCollapsed: (key: string, collapsed: boolean) =>
        setFolds((f) => ({ ...f, [key]: collapsed })),
    }),
    [lab, collapsedSections, setFolds],
  );
  return (
    <SidebarRegion
      contributions={contributionsIn(contributions, region)}
      ctx={ctx}
      region={region}
    />
  );
}

/** The lab's sidebar sections. Fold state is a lab-scoped persisted value, so it
 *  survives a reload in a stored lab and lasts the session in an unstored one. */
export function LabSidebarRegion({ contributions }: LabRegionProps) {
  return <LabSections contributions={contributions} region="sidebar" />;
}

/** The lab's aside sections, on the far side of the workspace from the sidebar.
 *  Fold state persists the way the sidebar's does. */
export function LabAsideRegion({ contributions }: LabRegionProps) {
  return <LabSections contributions={contributions} region="aside" />;
}

/** The lab's readouts, in the shell footer below the workspace. */
export function LabFooterRegion({ contributions }: LabRegionProps) {
  const ctx = useLabChromeContext();
  return (
    <StatusRegion
      region="footer"
      contributions={contributionsIn(contributions, 'footer')}
      ctx={ctx}
    />
  );
}
