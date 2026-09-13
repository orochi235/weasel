import { useContext, useMemo } from 'react';
import { useStore } from 'zustand/react';
import { useLabContext } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import type { TrialTool } from '../tools/types';
import type { LabChromeContext, LabContribution, LabRegion } from './labTypes';
import { mergeContributions } from './merge';
import { StatusRegion } from './regions/StatusRegion';
import { ToolbarRegion } from './regions/ToolbarRegion';

/** The lab's chrome context: the lab itself, plus the lab's tool slot. Throws
 *  outside a `<Lab>`. */
export function useLabChromeContext(): LabChromeContext {
  const lab = useLabContext();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] lab chrome requires <LabStoreProvider>');
  const activeToolId = useStore(storeCtx.store, (s) => s.activeToolId);
  const setLabTool = useStore(storeCtx.store, (s) => s.setLabTool);
  return useMemo(
    () => ({ ...lab, activeToolId, setActiveTool: setLabTool }),
    [lab, activeToolId, setLabTool],
  );
}

/** The lab's contributions for one region, in declaration order. */
export function contributionsIn(
  contributions: readonly LabContribution[],
  region: LabRegion,
): LabContribution[] {
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
