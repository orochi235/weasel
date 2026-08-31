import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
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
    <>
      <div className="lk-panel-tile__titlebar">
        <span className="lk-panel-tile__title">{item.title}</span>
        <button
          type="button"
          className="lk-panel-tile__dock"
          aria-label={`Dock ${item.title}`}
          title={`Dock ${item.title}`}
          onClick={() => onDock(contribution.id)}
        >
          ⇤
        </button>
      </div>
      {item.body}
    </>,
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
