import { pointInPolygon, pointSegmentDist2, polygonFromPoints } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { aimSpace2d, type AimOutline, type AimSpace, type ViewAim } from './aim';

/** An aim handed in by value (another surface's view, a 3D pane), with the writer that moves it. */
export interface AimSource {
  aim(): ViewAim | null;
  setAim?(aim: ViewAim): void;
  /** Tells a marker drawing this aim that it changed, so the marker repaints. Without it the marker
   *  repaints only when something else asks for a redraw. Returns an unsubscribe. */
  subscribe?(listener: () => void): () => void;
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
  /** Default true: dragging the marker edits the source's aim. A source with no writer is never interactive.
   *  A marker grabs its interior plus {@link VIEW_MARKER_HIT_SLOP_PX} while it covers at most three quarters
   *  of its frame, and past that only a band that wide either side of its rim, so the frame keeps its presses. */
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
    // Read when the canvas subscribes: a source swapped later is heard once it next resubscribes its layers.
    subscribe: (listener) => {
      const { source } = props();
      return source !== null && typeof source === 'object' && source.subscribe ? source.subscribe(listener) : () => {};
    },
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

/** A press on a marker, held for the drag: where it started, and the aim it started from. */
export interface ViewMarkerGrab {
  readonly markerId: string;
  /** Pan the source so the world point under the press ends up under `world`, a point in the target's world. */
  moveTo(world: { x: number; y: number }): void;
}

/** A press this many screen px outside the outline still counts. */
export const VIEW_MARKER_HIT_SLOP_PX = 4;

/** The share of its frame a marker can cover and still grab its interior. */
const INTERIOR_MAX_COVER = 0.75;

/**
 * The grab for a press at frame px `at` in `space`, the marker's target, or
 * `null` when the marker is not interactive, its source has no writer or no
 * aim, or `at` is not on its outline or within {@link VIEW_MARKER_HIT_SLOP_PX} of it — of its rim alone, for a
 * marker covering most of its frame (see {@link ViewMarkerProps.interactive}). A surface with views
 * calls this itself; a canvas with none, such as a detached minimap, calls it to route a press to its marker.
 */
export function grabViewMarker(
  props: ViewMarkerProps,
  host: ViewMarkerHost,
  space: AimSpace,
  at: { x: number; y: number },
): ViewMarkerGrab | null {
  const { id, source, target, interactive } = props;
  if (interactive === false || source === target) return null;
  const write = source === null || typeof source === 'string'
    ? (aim: ViewAim) => { host.setAim(source, aim); }
    : source.setAim?.bind(source);
  if (!write) return null;
  const startAim = markerSourceAim(source, host);
  const outline = startAim?.outlineIn(space);
  if (!startAim || !outline) return null;
  const interior = polygonArea(outline) <= INTERIOR_MAX_COVER * space.size.width * space.size.height;
  if (!outlineHolds(outline, at, VIEW_MARKER_HIT_SLOP_PX, interior)) return null;
  return {
    markerId: id,
    moveTo: (world) => {
      const to = space.project(world);
      const next = to && startAim.pannedIn(space, at, to);
      if (next) write(next);
    },
  };
}

function polygonArea(outline: AimOutline): number {
  let twice = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

function outlineHolds(outline: AimOutline, p: { x: number; y: number }, slop: number, interior: boolean): boolean {
  if (interior && pointInPolygon(outline.flatMap((q) => [q.x, q.y]), p.x, p.y)) return true;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if (pointSegmentDist2(p.x, p.y, a.x, a.y, b.x, b.y) <= slop * slop) return true;
  }
  return false;
}
