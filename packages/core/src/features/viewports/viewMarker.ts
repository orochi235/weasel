import { polygonFromPoints } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { aimSpace2d, type ViewAim } from './aim';

/** An aim handed in by value (another surface's view, a 3D pane), with the writer that moves it. */
export interface AimSource {
  aim(): ViewAim | null;
  setAim?(aim: ViewAim): void;
}

/** How a marker's outline is stroked, in screen px. */
export interface ViewMarkerStyle {
  stroke?: string;
  width?: number;
  dash?: readonly number[];
}

/** One view's aim, drawn inside another view's frame. */
export interface ViewMarkerProps {
  /** Unique among the markers on one surface. */
  id: string;
  /** Whose aim: a view id on this surface, `null` for the root view, or an aim by value. */
  source: string | null | AimSource;
  /** Whose frame it is drawn in, after that view's layers: a view id, or `null` for the root. */
  target: string | null;
  /** Screen px. Default: stroke `#ffffff`, width 1, dash [2, 3]. */
  style?: ViewMarkerStyle;
  /** Default true: dragging the marker edits the source's aim. A source with no writer is never interactive. */
  interactive?: boolean;
}

/** The marker style a {@link ViewMarkerProps.style} fills in from: the minimap indicator's. */
export const VIEW_MARKER_DEFAULT_STYLE: Required<ViewMarkerStyle> = { stroke: '#ffffff', width: 1, dash: [2, 3] };

/** What a marker resolves aims through: the surface's views. */
export interface ViewMarkerHost {
  aimOf(id: string | null): ViewAim | null;
  setAim(id: string | null, aim: ViewAim): boolean;
}

/** The aim `source` names: a view's through `host`, or one handed in by value. */
export function markerSourceAim(source: ViewMarkerProps['source'], host: ViewMarkerHost): ViewAim | null {
  return source === null || typeof source === 'string' ? host.aimOf(source) : source.aim();
}

/** A screen-space layer, id `view-marker:<id>`, drawing `props`'s source aim in the frame it is handed. */
export function createViewMarkerLayer(props: () => ViewMarkerProps, host: ViewMarkerHost): RenderLayer<unknown> {
  const { id } = props();
  return {
    id: `view-marker:${id}`,
    label: `View marker ${id}`,
    space: 'screen',
    draw: (_data, view, dims): DrawCommand[] => {
      const { source, target, style } = props();
      if (source === target) return [];
      const aim = markerSourceAim(source, host);
      const outline = aim?.outlineIn(aimSpace2d(target, view, dims));
      if (!outline) return [];
      const d = VIEW_MARKER_DEFAULT_STYLE;
      return [{
        kind: 'path',
        path: polygonFromPoints(outline),
        stroke: {
          paint: { kind: 'solid', color: style?.stroke ?? d.stroke },
          width: style?.width ?? d.width,
          dash: [...(style?.dash ?? d.dash)],
        },
      }];
    },
  };
}
