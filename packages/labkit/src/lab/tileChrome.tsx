import type { ReactNode } from 'react';
import type { NodeId } from 'windease';
import type { ChromeMap } from 'windease/react';
import { Lightbox } from '../lightbox/Lightbox';
import { TrialDragContext } from '../trial/TrialDragContext';
import { usePanelHosts } from './panelHost';
import { PANEL_KIND, panelNodeId, TRIAL_KIND } from './workspaceStore';

/** One undocked panel, as the workspace needs to know it. */
export interface PanelDescriptor {
  /** Stable key; also the portal host key the owning trial writes into. */
  key: string;
  title: string;
  as: 'tile' | 'floating';
  /** The trial the panel was torn out of, which keys pressed and presses in the panel go to. */
  trialId?: string;
}

/** The frame an undocked panel gets: a box, and the host element its trial
 *  portals into. The title and the dock control come through the portal with
 *  the body — the workspace knows a panel's key, not what is in it. */
function PanelFrame({ panel, floating = false }: { panel: PanelDescriptor; floating?: boolean }) {
  const hosts = usePanelHosts();
  return (
    <div
      className={floating ? 'lk-panel-tile lk-panel-tile--floating' : 'lk-panel-tile'}
      data-trial-id={panel.trialId}
    >
      <div className="lk-panel-tile__body" ref={(el) => hosts?.set(panel.key, el)} />
    </div>
  );
}

/** The layer floating panels sit in, above the grid; nothing while there are none. */
export function FloatingPanels({ panels }: { panels: readonly PanelDescriptor[] }) {
  if (panels.length === 0) return null;
  return (
    <div className="lk-workspace__floating">
      {panels.map((p) => (
        <PanelFrame key={p.key} panel={p} floating />
      ))}
    </div>
  );
}

/** What the grid's tiles are drawn from. */
export interface TileChromeSources {
  /** Every tile's node id: the trials', positionally matched to `items`, then the tile panels'. */
  nodeIds: readonly NodeId[];
  items: readonly ReactNode[];
  tilePanels: readonly PanelDescriptor[];
  reorderable: boolean;
  lightbox: boolean | ((id: string) => boolean);
  expandOnDoubleClick: boolean | ((id: string) => boolean);
}

/** How the grid draws each kind of tile: a panel as its frame, a trial inside its lightbox, and inside a drag
 *  context when tiles reorder. */
export function createTileChrome({
  nodeIds,
  items,
  tilePanels,
  reorderable,
  lightbox,
  expandOnDoubleClick,
}: TileChromeSources): ChromeMap {
  const lightboxFor = typeof lightbox === 'function' ? lightbox : () => lightbox;
  const doubleClickFor =
    typeof expandOnDoubleClick === 'function' ? expandOnDoubleClick : () => expandOnDoubleClick;
  const byId = new Map<string, ReactNode>(nodeIds.map((id, i) => [id, items[i]]));
  const panelByNode = new Map<string, PanelDescriptor>(
    tilePanels.map((p) => [panelNodeId(p.key), p]),
  );
  return {
    [PANEL_KIND]: ({ node }) => {
      const panel = panelByNode.get(String(node.id));
      if (!panel) return null;
      return <PanelFrame panel={panel} />;
    },
    [TRIAL_KIND]: ({ node }) => {
      const id = String(node.id);
      const tile = (
        // `disabled` rather than leaving the wrapper out, so turning the
        // lightbox off cannot remount the tile.
        <Lightbox
          className="lk-trial-tile"
          disabled={!lightboxFor(id)}
          expandOnDoubleClick={doubleClickFor(id)}
        >
          {byId.get(node.id) ?? null}
        </Lightbox>
      );
      if (!reorderable) return tile;
      return (
        // No grip strip: the tile's own `<TileGrip>` is the drag surface.
        <TrialDragContext.Provider value={{ nodeId: node.id }}>{tile}</TrialDragContext.Provider>
      );
    },
  };
}
