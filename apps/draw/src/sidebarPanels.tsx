import { inferredNodeProperties, toHex8, useOngoingAction } from '@weasel-js/core';
import { AnchorFields } from '@weasel-js/ui/components/AnchorFields';
import { SelectionPanel } from '@weasel-js/ui/components/SelectionPanel';
import { SwatchStrip } from '@weasel-js/ui/components/SwatchStrip';
import { solidColorOf } from '@weasel-js/ui/paint-value';
import { type ReactElement, useCallback, useSyncExternalStore } from 'react';
import type { ActivePaint } from './ActiveSwatches';
import { DOCUMENT_UNITS } from './documentUnits';
import { LayersContent } from './LayersPanel';
import { DRAW_NODE_ROUTING, drawKindLabel } from './nodeKinds';
import { WD_RENDERERS } from './paintRenderers';
import { useSurfaceHost } from './surfaces/hostContext';
import { useColorContext } from './tools/colorContext';
import { HistoryList } from './ui/HistoryList';

/** The selection's anchor and properties: what the Properties asset shows while no document row is picked. */
export function SelectionProperties(): ReactElement {
  const host = useSurfaceHost();
  return (
    <>
      <AnchorFields accepts={DOCUMENT_UNITS} unit="pt" />
      <SelectionPanel
        scene={host.scene}
        selection={host.selection}
        properties={inferredNodeProperties}
        routing={DRAW_NODE_ROUTING}
        kindLabel={drawKindLabel}
        renderers={WD_RENDERERS}
        emptyState={<em className="wd-no-selection">No selection</em>}
      />
    </>
  );
}

/** Every undo entry, the current one marked; picking one jumps there. */
export function HistoryEntries(): ReactElement {
  const { scene } = useSurfaceHost();
  const subscribe = useCallback((fn: () => void) => scene.subscribe(fn), [scene]);
  useSyncExternalStore(subscribe, () => scene.getVersion());
  return (
    <HistoryList
      items={[
        { id: '__initial__', label: 'Initial' },
        ...scene.historyEntries().map((e) => ({ id: e.id, label: e.label })),
      ]}
      currentIndex={scene.historyIndex()}
      onJump={(index) => scene.jumpToHistoryIndex(index)}
    />
  );
}

/** The palette: a click paints the focused slot, a shift- or right-click the other one. */
export function PaletteSwatches(): ReactElement {
  const colors = useColorContext();
  const edits = { fill: useOngoingAction('setFill'), stroke: useOngoingAction('setStroke') };
  const other = colors.focused === 'fill' ? 'stroke' : 'fill';
  // Each lands on the active paint and on the selection.
  const apply = (slot: 'fill' | 'stroke', v: string | null): void => {
    const paint: ActivePaint = v === null ? null : { kind: 'solid', color: v };
    if (slot === 'fill') colors.setFill(paint);
    else colors.setStroke(paint);
    edits[slot].commit(v === null ? { paint: null } : { color: v });
  };
  const focusedPaint = colors.focused === 'fill' ? colors.fill : colors.stroke;
  return (
    <SwatchStrip
      aria-label="Palette"
      value={focusedPaint === null ? null : solidColorOf(focusedPaint)}
      columns={10}
      onChange={(v) => apply(colors.focused, v)}
      onAltChange={(v) => apply(other, v)}
    />
  );
}

/** The document's nodes, front to back, over the host's scene. */
export function DocumentLayers(): ReactElement {
  const host = useSurfaceHost();
  return (
    <LayersContent
      scene={host.scene}
      selection={host.selection}
      measurements={host.measurements}
      backgroundColor={host.backgroundColor}
      docSelected={host.docSelected}
      setDocSelected={host.setDocSelected}
    />
  );
}

/** The document background as the `#rrggbbaa` an alpha color leaf holds. */
export const backgroundHex = (color: string): string => {
  const hex8 = toHex8(color);
  return hex8.startsWith('#') && hex8.length >= 7 ? hex8 : '#000000ff';
};
