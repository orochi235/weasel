import {
  getAlpha01,
  inferredNodeProperties,
  toHex8,
  useOngoingAction,
  withAlpha01
} from '@weasel-js/core';
import { AnchorFields } from '@weasel-js/ui/components/AnchorFields';
import { PropertyField, PropertyList } from '@weasel-js/ui/components/Properties';
import { SelectionPanel } from '@weasel-js/ui/components/SelectionPanel';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { SwatchStrip } from '@weasel-js/ui/components/SwatchStrip';
import { solidColorOf } from '@weasel-js/ui/paint-value';
import type { ReactElement } from 'react';
import type { ActivePaint } from './ActiveSwatches';
import { DEFAULT_FILENAME } from './docPersistence';
import { DOCUMENT_UNITS } from './documentUnits';
import { DRAW_NODE_ROUTING, drawKindLabel } from './nodeKinds';
import { WD_RENDERERS } from './paintRenderers';
import { PAPER_OPTIONS, type PaperSizeKey } from './paperSizes';
import type { PanelChrome, SidebarHost } from './surfaces/types';
import { useColorContext } from './tools/colorContext';
import { HistoryList } from './ui/HistoryList';

/** The `#rrggbb` a native color input accepts; non-hex colors fall back to black. */
export function opaqueHex(color: string): string {
  const hex8 = toHex8(color);
  return hex8.startsWith('#') && hex8.length >= 7 ? hex8.slice(0, 7) : '#000000';
}

const chromeProps = (chrome: PanelChrome) => ({
  collapsed: chrome.collapsed,
  onToggleCollapse: chrome.onToggleCollapse,
  onHide: chrome.onHide,
});

export function PropertiesPanel({ host, chrome }: { host: SidebarHost; chrome: PanelChrome }): ReactElement {
  const { docSelected, filename, setFilename, paperSize, setPaperSize, backgroundColor, setBackgroundColor } = host;
  return (
    <SidebarPanel title={docSelected ? 'Document' : 'Properties'} {...chromeProps(chrome)}>
      {docSelected ? (
        <PropertyList>
          <PropertyField kind="string" label="File" value={filename} placeholder={DEFAULT_FILENAME} onChange={setFilename} />
          <PropertyField<PaperSizeKey>
            kind="enum"
            label="Paper"
            value={paperSize}
            options={PAPER_OPTIONS}
            onChange={setPaperSize}
          />
          <PropertyField
            kind="color"
            label="Background"
            value={opaqueHex(backgroundColor)}
            onChange={(rgb) => setBackgroundColor(withAlpha01(rgb, getAlpha01(backgroundColor)))}
            alpha={getAlpha01(backgroundColor)}
            onAlphaChange={(a) => setBackgroundColor(withAlpha01(backgroundColor, a))}
          />
        </PropertyList>
      ) : (
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
      )}
    </SidebarPanel>
  );
}

export function HistoryPanel({ host, chrome }: { host: SidebarHost; chrome: PanelChrome }): ReactElement {
  const { scene } = host;
  return (
    <SidebarPanel title="History" {...chromeProps(chrome)}>
      <HistoryList
        items={[
          { id: '__initial__', label: 'Initial' },
          ...scene.historyEntries().map((e) => ({ id: e.id, label: e.label })),
        ]}
        currentIndex={scene.historyIndex()}
        onJump={(index) => scene.jumpToHistoryIndex(index)}
      />
    </SidebarPanel>
  );
}

export function ColorsPanel({ chrome }: { chrome: PanelChrome }): ReactElement {
  const colors = useColorContext();
  const edits = { fill: useOngoingAction('setFill'), stroke: useOngoingAction('setStroke') };
  const other = colors.focused === 'fill' ? 'stroke' : 'fill';
  // A click paints the focused slot, a shift- or right-click the other one;
  // each lands on the active paint and on the selection.
  const apply = (slot: 'fill' | 'stroke', v: string | null): void => {
    const paint: ActivePaint = v === null ? null : { kind: 'solid', color: v };
    if (slot === 'fill') colors.setFill(paint);
    else colors.setStroke(paint);
    edits[slot].commit(v === null ? { paint: null } : { color: v });
  };
  const focusedPaint = colors.focused === 'fill' ? colors.fill : colors.stroke;
  return (
    <SidebarPanel title="Colors" {...chromeProps(chrome)}>
      <SwatchStrip
        aria-label="Palette"
        value={focusedPaint === null ? null : solidColorOf(focusedPaint)}
        columns={10}
        onChange={(v) => apply(colors.focused, v)}
        onAltChange={(v) => apply(other, v)}
      />
    </SidebarPanel>
  );
}
