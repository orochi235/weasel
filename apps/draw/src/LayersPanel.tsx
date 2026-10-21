import {
  isGradientPaint,
  isTilePaint,
  type Measurements,
  measurementOf,
  type Paint,
  resolveFill,
  sampleGradientStops,
  type SelectionApi,
} from '@weasel-js/core';
import { decimal, qty } from '@weasel-js/quantity';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { useContextMenu } from '@weasel-js/ui/components/ContextMenu';
import { LayerList, type LayerListItem, useSceneLayerList } from '@weasel-js/ui/components/LayerList';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { type CSSProperties, type MouseEvent, type ReactElement, useSyncExternalStore } from 'react';
import type { DrawScene, WeaselDrawData } from './drawDocument';
import type { PanelChrome } from './surfaces/types';
import { usePref } from './prefs';

/** Synthetic id for the fixed "Background" row in the Layers panel.
 *  Selecting this row surfaces the Document properties branch in the
 *  Properties panel; clicking any real node clears it. */
export const BACKGROUND_ROW_ID = '__background__';

const AT = decimal({ places: 1, grouping: false });

/**
 * The color chip on a layer row. Every node kind keeps its paint in
 * `data.fill`, text included; a node with no fill shows no chip.
 */
export function LayerSwatch({ color }: { color: string | undefined }): ReactElement | null {
  if (color === undefined) return null;
  // A custom property rather than a class: the chip's color is the node's data.
  return <span className="wd-layer-swatch" style={{ '--wd-swatch': color } as CSSProperties} aria-hidden="true" />;
}

export function layerSwatch(data: WeaselDrawData): string | undefined {
  const fill = resolveFill(data.fill);
  return fill ? paintChipColor(fill.paint) : undefined;
}

/** One representative color for a `Paint`, for a chip too small to draw
 *  the real paint: a gradient shows its midpoint, which reads closer to the
 *  whole ramp than either end does, and a tile pattern shows the color it
 *  draws with. A `texture` paint has no color to report. */
export function paintChipColor(fill: Paint): string | undefined {
  if (isGradientPaint(fill)) return sampleGradientStops(fill.stops, 0.5);
  if (fill.kind === undefined || fill.kind === 'solid') return fill.color;
  if (isTilePaint(fill)) return fill.color;
  return undefined;
}

export interface LayersPanelProps {
  scene: DrawScene;
  selection: SelectionApi;
  measurements: Measurements;
  backgroundColor: string;
  docSelected: boolean;
  setDocSelected: (v: boolean) => void;
  chrome: PanelChrome;
}

/**
 * The Layers panel: a row per node, front to back, and a fixed Background
 * row last. Each row hides, locks and renames its node; a name is
 * `data.label`, shown in place of a text node's text. With
 * `ui.showAnnotations` on, the annotation layer — the measurements — and each
 * measurement are listed too, marked not printed; picking one there picks the
 * measurement, as a click on it does.
 */
export function LayersPanel(props: LayersPanelProps): ReactElement {
  const { scene, selection, measurements: ms, docSelected, setDocSelected, chrome } = props;
  const [showAnnotations, setShowAnnotations] = usePref('ui.showAnnotations');
  const picked = useSyncExternalStore(ms.picked.subscribe, ms.picked.get, ms.picked.get);
  const base = useSceneLayerList({
    scene,
    selection,
    itemFor: (node) => {
      const m = measurementOf(node);
      if (m) return { label: node.data.label ?? `Measurement ${qty(m.distance, AT).text}` };
      const data = node.data;
      return { label: data.label ?? data.text ?? node.id, leading: <LayerSwatch color={layerSwatch(data)} /> };
    },
    rename: (node, label) => ({ ...node.data, label }),
    ...(showAnnotations
      ? { annotations: { picked, pick: (id: string | null) => ms.picked.set(id as never), labelOf: () => 'Measurements' } }
      : {}),
  });

  // A pinned, fixed virtual "Background" row. Selecting it routes to the
  // Document properties branch instead of the kit `SelectionApi` (the
  // synthetic id is not a real NodeId and would corrupt scene queries).
  const backgroundRow: LayerListItem = {
    id: BACKGROUND_ROW_ID,
    label: 'Background',
    leading: <LayerSwatch color={props.backgroundColor} />,
    fixed: true,
  };
  const onSelect = (ids: string[]): void => {
    if (ids.includes(BACKGROUND_ROW_ID)) {
      setDocSelected(true);
      selection.set([]);
    } else {
      setDocSelected(false);
      base.onSelect(ids);
    }
  };
  const selectedIds = docSelected ? [BACKGROUND_ROW_ID] : base.selectedIds;
  const openRowMenu = useContextMenu('draw.layerRow');
  const onRowContextMenu = (id: string, e: MouseEvent): void => {
    if (id === BACKGROUND_ROW_ID) return;
    if (!selectedIds.includes(id)) onSelect([id]);
    openRowMenu(e);
  };

  return (
    <SidebarPanel
      title="Layers"
      collapsed={chrome.collapsed}
      onToggleCollapse={chrome.onToggleCollapse}
      onHide={chrome.onHide}
    >
      <Checkbox isSelected={showAnnotations} onChange={setShowAnnotations}>Show annotations</Checkbox>
      <LayerList
        {...base}
        items={[...base.items, backgroundRow]}
        selectedIds={selectedIds}
        onSelect={onSelect}
        onRowContextMenu={onRowContextMenu}
        empty="No nodes"
      />
    </SidebarPanel>
  );
}
