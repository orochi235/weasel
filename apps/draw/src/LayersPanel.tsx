import {
  isGradientPaint,
  isSolidPaint,
  isTilePaint,
  type Measurements,
  measurementOf,
  type Paint,
  resolveTextStyle,
  sampleGradientStops,
  type SelectionApi,
} from '@weasel-js/core';
import { decimal, qty } from '@weasel-js/quantity';
import { Checkbox, LayerList, type LayerListItem, SidebarPanel, useSceneLayerList } from '@weasel-js/ui';
import { type CSSProperties, type ReactElement, useSyncExternalStore } from 'react';
import type { DrawScene, WeaselDrawData } from './drawDocument';
import type { PanelChrome } from './panels';
import { usePref } from './prefs';

/** Synthetic id for the locked "Background" row in the Layers panel.
 *  Selecting this row surfaces the Document properties branch in the
 *  Properties panel; clicking any real node clears it. */
export const BACKGROUND_ROW_ID = '__background__';

const AT = decimal({ places: 1, grouping: false });

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
  if (data.fill?.paint) return paintChipColor(data.fill.paint);
  if (data.text === undefined) return undefined;
  const paint = resolveTextStyle(data.style, { fill: data.fill }).fill?.paint;
  return isSolidPaint(paint) ? paint.color : undefined;
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
 * The Layers panel: a row per node, front to back, and a locked Background
 * row last. With `ui.showAnnotations` on, the annotation layer — the
 * measurements — and each measurement are listed too, marked not printed;
 * picking one there picks the measurement, as a click on it does.
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
      return { label: data.text ?? data.label ?? node.id, leading: <LayerSwatch color={layerSwatch(data)} /> };
    },
    ...(showAnnotations
      ? { annotations: { picked, pick: (id: string | null) => ms.picked.set(id as never), labelOf: () => 'Measurements' } }
      : {}),
  });

  // A pinned, locked virtual "Background" row. Selecting it routes to the
  // Document properties branch instead of the kit `SelectionApi` (the
  // synthetic id is not a real NodeId and would corrupt scene queries).
  const backgroundRow: LayerListItem = {
    id: BACKGROUND_ROW_ID,
    label: 'Background',
    leading: <LayerSwatch color={props.backgroundColor} />,
    locked: true,
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
        selectedIds={docSelected ? [BACKGROUND_ROW_ID] : base.selectedIds}
        onSelect={onSelect}
        empty="No nodes"
      />
    </SidebarPanel>
  );
}
