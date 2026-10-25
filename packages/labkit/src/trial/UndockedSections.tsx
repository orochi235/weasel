import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { DockButton, Section } from '../chrome/regions/SidebarRegion';
import type { SidebarSection, TrialContribution } from '../chrome/types';
import { usePanelHosts } from '../lab/panelHost';
import { panelKey } from '../state/undock';

/** Props for `<UndockedSections>`. */
export interface UndockedSectionsProps {
  trialId: string;
  /** The trial's sidebar contributions that are currently torn out. */
  sections: readonly TrialContribution[];
  onDock: (sectionId: string) => void;
}

function Portalled({
  trialId,
  contribution,
  onDock,
}: {
  trialId: string;
  contribution: TrialContribution;
  onDock: (sectionId: string) => void;
}) {
  const hosts = usePanelHosts();
  const key = panelKey(trialId, contribution.id);
  const host = useSyncExternalStore(
    (fn) => hosts?.subscribe(fn) ?? (() => {}),
    () => hosts?.get(key) ?? null,
    () => null,
  );
  if (!host || !contribution.item) return null;
  const item = contribution.item as SidebarSection;
  return createPortal(
    <Section
      title={item.title}
      stance={item.stance}
      grade={item.grade}
      emphasis={item.emphasis}
      tint={item.tint}
      actions={item.actions}
      trailing={<DockButton title={item.title} dock onPress={() => onDock(contribution.id)} />}
    >
      {item.body}
    </Section>,
    host,
  );
}

/** Renders a torn-out section's body into the workspace panel holding it. The
 *  body stays mounted in the trial's React tree — only its DOM moves — so it
 *  keeps the trial's context and its own state across an undock. */
export function UndockedSections({ trialId, sections, onDock }: UndockedSectionsProps) {
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map((c) => (
        <Portalled key={c.id} trialId={trialId} contribution={c} onDock={onDock} />
      ))}
    </>
  );
}
