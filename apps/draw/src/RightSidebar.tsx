import {
  type FillStyle,
  getAlpha01,
  inferredNodeProperties,
  inferredNodeRouting,
  isGradientFill,
  resolveTextStyle,
  sampleGradientStops,
  toHex8,
  useOngoingAction,
  useScene,
  useSelection,
  withAlpha01
} from '@weasel-js/core';
import {
  LayerList,
  type LayerListItem,
  PropertyField,
  PropertyList,
  type PropertyOption,
  SelectionPanel,
  SidebarPanel,
  SwatchStrip,
  useSceneLayerList
} from '@weasel-js/ui';
import {
  lazy,
  type CSSProperties, type ReactElement,
  Suspense
} from 'react';
import type { ActivePaint } from './ActiveSwatches';
import type { PaperSizeKey } from './CommandBar';
import { DEFAULT_FILENAME } from './docPersistence';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { WD_RENDERERS } from './paintRenderers';
import { type PanelChrome, usePanel } from './panels';
import { useColorContext } from './tools/colorContext';
import { HistoryList } from './ui/HistoryList';

// The trace log it reads is only populated in DEV, so production leaves the
// panel out of the bundle entirely.
const DispatchTracePanel = import.meta.env.DEV
  ? lazy(() => import('./dev/DispatchTracePanel').then((m) => ({ default: m.DispatchTracePanel })))
  : null;

/** Synthetic id for the locked "Background" row in the Layers panel.
 *  Selecting this row surfaces the Document properties branch in the
 *  Properties panel; clicking any real node clears it. */
export const BACKGROUND_ROW_ID = '__background__';

// ─── Right sidebar: LayerList + SelectionPanel ──────────────────────────────

/**
 * The color chip on a layer row. Every node kind keeps its paint in
 * `data.fill`, text included.
 *
 * `resolveTextStyle` is the same function the renderer resolves through, so
 * an unpainted text node reports the black it actually paints rather than
 * nothing. Non-solid paints (gradient, pattern) have no single color to show
 * and return undefined until the row can draw a real preview.
 */
export function LayerSwatch({ color }: { color: string | undefined }): ReactElement | null {
  if (color === undefined) return null;
  // A custom property rather than a class: the chip's color is the node's data.
  return <span className="wd-layer-swatch" style={{ '--wd-swatch': color } as CSSProperties} aria-hidden="true" />;
}

export function layerSwatch(data: WeaselDrawData): string | undefined {
  if (data.fill != null) return paintChipColor(data.fill);
  if (data.text === undefined) return undefined;
  const { fill } = resolveTextStyle(data.style, { fill: data.fill });
  return fill !== null && 'color' in fill ? fill.color : undefined;
}

/** One representative color for a `FillStyle`, for a chip too small to draw
 *  the real paint: a gradient shows its midpoint, which reads closer to the
 *  whole ramp than either end does, and a tile pattern shows the color it
 *  draws with. A pattern built from a raw `TextureHandle` has no color to
 *  report. */
export function paintChipColor(fill: FillStyle): string | undefined {
  if (isGradientFill(fill)) return sampleGradientStops(fill.stops, 0.5);
  if (fill.fill === undefined || fill.fill === 'solid') return fill.color;
  if (fill.fill === 'pattern' && 'tile' in fill.pattern) return fill.pattern.color;
  return undefined;
}

export const PAPER_SIZE_OPTIONS: ReadonlyArray<PropertyOption<PaperSizeKey>> = [
  { value: 'letter', label: 'Letter' },
  { value: 'a4', label: 'A4' },
  { value: 'legal', label: 'Legal' },
];

/** The `#rrggbb` a native color input accepts; non-hex colors fall back to black. */
export function opaqueHex(color: string): string {
  const hex8 = toHex8(color);
  return hex8.startsWith('#') && hex8.length >= 7 ? hex8.slice(0, 7) : '#000000';
}

export interface RightSidebarProps {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
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
  filename,
  setFilename,
  backgroundColor,
  setBackgroundColor,
  paperSize,
  setPaperSize,
  docSelected,
  setDocSelected,
}: RightSidebarProps): ReactElement {
  const baseLayerListProps = useSceneLayerList({
    scene,
    selection,
    itemFor: (node) => {
      const data = node.data as WeaselDrawData;
      return {
        label: data.text ?? data.label ?? node.id,
        leading: <LayerSwatch color={layerSwatch(data)} />,
      };
    },
  });

  // Augment the kit-derived layer items with a pinned, locked virtual
  // "Background" row. Selecting it routes to the Document properties
  // branch instead of the kit `SelectionApi` (the synthetic id is not a
  // real NodeId and would corrupt scene queries).
  const backgroundRow: LayerListItem = {
    id: BACKGROUND_ROW_ID,
    label: 'Background',
    leading: <LayerSwatch color={backgroundColor} />,
    locked: true,
  };
  const layerItems = [...baseLayerListProps.items, backgroundRow];
  const layerSelectedIds = docSelected
    ? [BACKGROUND_ROW_ID]
    : baseLayerListProps.selectedIds;
  const onLayerSelect = (ids: string[]): void => {
    if (ids.includes(BACKGROUND_ROW_ID)) {
      setDocSelected(true);
      selection.set([]);
    } else {
      setDocSelected(false);
      baseLayerListProps.onSelect(ids);
    }
  };
  const layerListProps = {
    ...baseLayerListProps,
    items: layerItems,
    selectedIds: layerSelectedIds,
    onSelect: onLayerSelect,
  };

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
                options={PAPER_SIZE_OPTIONS}
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
          )}
        </SidebarPanel>
      )}
      {!colorsPanel.hidden && <ColorsPanel chrome={colorsPanel} />}
      {!layersPanel.hidden && (
        <SidebarPanel
          title="Layers"
          collapsed={layersPanel.collapsed}
          onToggleCollapse={layersPanel.onToggleCollapse}
          onHide={layersPanel.onHide}
        >
          <LayerList {...layerListProps} empty="No nodes" />
        </SidebarPanel>
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
    const paint: ActivePaint = v === null ? { kind: 'none' } : { kind: 'solid', color: v };
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
        value={focusedPaint.kind === 'solid' ? focusedPaint.color : focusedPaint.kind === 'none' ? null : undefined}
        columns={10}
        onChange={(v) => apply(colors.focused, v)}
        onAltChange={(v) => apply(other, v)}
      />
    </SidebarPanel>
  );
}
