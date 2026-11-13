import { useMemo } from 'react';
import { useStore } from 'zustand/react';
import type { TrialContribution, TrialSidebar } from '../chrome/types';
import type { LabStore } from '../state/store';
import type { UndockedPanels } from '../state/undock';
import { Trial } from '../trial/Trial';
import { useLabCommands } from './LabContext';
import type { LabProps } from './labProps';
import { type PanelDescriptor, type TrialLayout, Workspace } from './Workspace';

function panelsOf(undocked: UndockedPanels): PanelDescriptor[] {
  return Object.entries(undocked).map(([key, panel]) => ({
    key,
    title: panel.sectionId,
    as: panel.as,
  }));
}

/** Whether a double-click opens a trial in its lightbox, asked of its record when the lab's answer is a function. */
function doubleClickExpands(
  expand: NonNullable<LabProps['expandOnDoubleClick']>,
  store: LabStore,
): boolean | ((id: string) => boolean) {
  if (typeof expand !== 'function') return expand;
  return (id) => {
    const trial = store.getState().trials.find((t) => t.id === id);
    return trial ? expand(trial) : false;
  };
}

/** What every trial of a lab is rendered with. */
export interface TrialOptions {
  chrome: readonly TrialContribution[] | undefined;
  suppress: LabProps['suppress'];
  hide: LabProps['hide'];
  sidebar: TrialSidebar | undefined;
}

/** A lab's trials, a tile each, in the grid the lab's store lays out. */
export function TrialWorkspace({
  store,
  ids,
  expandOnDoubleClick,
  trialOptions,
}: {
  store: LabStore;
  ids: readonly string[];
  expandOnDoubleClick: NonNullable<LabProps['expandOnDoubleClick']>;
  trialOptions: TrialOptions;
}) {
  const commands = useLabCommands();
  const layout = useStore(store, (s) => s.layout);
  const undockedPanels = useStore(store, (s) => s.undockedPanels);
  const panels = useMemo(() => panelsOf(undockedPanels), [undockedPanels]);
  return (
    <Workspace
      panels={panels}
      ids={ids}
      resizable
      reorderable
      onReorder={(next) => commands.reorderTrials(next)}
      layout={layout as TrialLayout}
      onLayoutChange={(next) => store.getState().setLayout(next)}
      expandOnDoubleClick={doubleClickExpands(expandOnDoubleClick, store)}
    >
      {ids.map((id) => (
        <Trial key={id} id={id} {...trialOptions} />
      ))}
    </Workspace>
  );
}
