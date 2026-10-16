import {
  getAlpha01,
  inferredNodeProperties,
  inferredNodeRouting,
  type Measurements,
  toHex8,
  useOngoingAction,
  type SelectionApi,
  withAlpha01
} from '@weasel-js/core';
import {
  AnchorFields,
  PropertyField,
  PropertyList,
  SelectionPanel,
  SidebarPanel,
  solidColorOf,
  SwatchStrip
} from '@weasel-js/ui';
import { lazy, type ReactElement, Suspense } from 'react';
import type { ActivePaint } from './ActiveSwatches';
import { PAPER_OPTIONS, type PaperSizeKey } from './paperSizes';
import { DEFAULT_FILENAME } from './docPersistence';
import { DOCUMENT_UNITS } from './documentUnits';
import type { DrawScene } from './drawDocument';
import { LayersPanel } from './LayersPanel';
import { WD_RENDERERS } from './paintRenderers';
import { type PanelChrome, usePanel } from './panels';
import { useColorContext } from './tools/colorContext';
import { HistoryList } from './ui/HistoryList';

// The trace log it reads is only populated in DEV, so production leaves the
// panel out of the bundle entirely.
const DispatchTracePanel = import.meta.env.DEV
  ? lazy(() => import('./dev/DispatchTracePanel').then((m) => ({ default: m.DispatchTracePanel })))
  : null;

// ─── Right sidebar: Properties, Colors, Layers, History ──────────────────────

/** The `#rrggbb` a native color input accepts; non-hex colors fall back to black. */
export function opaqueHex(color: string): string {
  const hex8 = toHex8(color);
  return hex8.startsWith('#') && hex8.length >= 7 ? hex8.slice(0, 7) : '#000000';
}

export interface RightSidebarProps {
  scene: DrawScene;
  selection: SelectionApi;
  measurements: Measurements;
  filename: string;
  setFilename: (v: string) => void;
  backgroundColor: string;
  setBackgroundColor: (v: string) => void;
  paperSize: PaperSizeKey;
  setPaperSize: (v: PaperSizeKey) => void;
  docSelected: boolean;
  setDocSelected: (v: boolean) => void;
}

export function RightSidebar({
  scene,
  selection,
  measurements,
  filename,
  setFilename,
  backgroundColor,
  setBackgroundColor,
  paperSize,
  setPaperSize,
  docSelected,
  setDocSelected,
}: RightSidebarProps): ReactElement {
  const propertiesPanel = usePanel('properties');
  const colorsPanel = usePanel('colors');
  const layersPanel = usePanel('layers');
  const historyPanel = usePanel('history');

  return (
    <>
      {!propertiesPanel.hidden && (
        <SidebarPanel
          title={docSelected ? 'Document' : 'Properties'}
          collapsed={propertiesPanel.collapsed}
          onToggleCollapse={propertiesPanel.onToggleCollapse}
          onHide={propertiesPanel.onHide}
        >
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
                scene={scene}
                selection={selection}
                // WeaselDraw's kinds come from the kit's inferred routing (`text` /
                // `path` / `image` — no `data.kind` tag), so the panel classifies
                // with the same entries SceneCanvas applies when `routing` is unset.
                properties={inferredNodeProperties}
                routing={inferredNodeRouting}
                renderers={WD_RENDERERS}
                emptyState={<em className="wd-no-selection">No selection</em>}
              />
            </>
          )}
        </SidebarPanel>
      )}
      {!colorsPanel.hidden && <ColorsPanel chrome={colorsPanel} />}
      {!layersPanel.hidden && (
        <LayersPanel
          scene={scene}
          selection={selection}
          measurements={measurements}
          backgroundColor={backgroundColor}
          docSelected={docSelected}
          setDocSelected={setDocSelected}
          chrome={layersPanel}
        />
      )}
      {!historyPanel.hidden && (
        <SidebarPanel
          title="History"
          collapsed={historyPanel.collapsed}
          onToggleCollapse={historyPanel.onToggleCollapse}
          onHide={historyPanel.onHide}
        >
          <HistoryList
            items={[
              { id: '__initial__', label: 'Initial' },
              ...scene.historyEntries().map((e) => ({ id: e.id, label: e.label })),
            ]}
            currentIndex={scene.historyIndex()}
            onJump={(index) => scene.jumpToHistoryIndex(index)}
          />
        </SidebarPanel>
      )}
      {DispatchTracePanel && (
        <Suspense fallback={null}>
          <DispatchTracePanel />
        </Suspense>
      )}
    </>
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
    <SidebarPanel
      title="Colors"
      collapsed={chrome.collapsed}
      onToggleCollapse={chrome.onToggleCollapse}
      onHide={chrome.onHide}
    >
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
