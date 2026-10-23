import { useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useFloatingPlacement } from '../../floating/useFloatingPlacement';
import type { BarOrientation } from '../Bar';
import { DOCK_BAR } from './dockDrop';
import { DOCK_EMPTY } from './dockTear';
import type { DockSpec, FloatPlace, ToolbarLayout } from './layout';
import type { DockDragView } from './useDockDrag';
import s from './ToolbarDock.module.css';

/** Marks the layer floating bars sit in. */
export const DOCK_LAYER = 'data-dock-layer';

/** What {@link FloatingLayer} draws. */
export interface FloatingLayerProps {
  layerRef: RefObject<HTMLDivElement | null>;
  layout: ToolbarLayout;
  view: DockDragView | null;
  /** Empty docks the dragged bar may enter, each drawn as a strip it can drop on. */
  empties: readonly DockSpec[];
  /** A bar as the dock draws it, with its handle; null where it draws nothing. */
  draw: (id: string, orientation: BarOrientation) => ReactNode;
}

/**
 * The layer over the whole dock that floating bars sit in, and the bar a drag has torn off. It takes no pointer
 * events itself; the bars on it do.
 */
export function FloatingLayer({ layerRef, layout, view, empties, draw }: FloatingLayerProps) {
  const places = Object.entries(layout.floating).map(([id, place]): [string, FloatPlace] => [id, view?.barId === id && view.float ? view.float : place]);
  if (view?.float && !(view.barId in layout.floating)) places.push([view.barId, view.float]);
  return (
    <div ref={layerRef} className={s.layer} {...{ [DOCK_LAYER]: '' }}>
      {empties.map((dock) => (
        <div key={dock.id} className={s.empty} {...{ [DOCK_EMPTY]: dock.id }} data-dock-edge={dock.edge} data-dock-drop={view?.drop && 'dock' in view.drop && view.drop.dock === dock.id ? 'row' : undefined} />
      ))}
      {places.map(([id, place]) => {
        const drawn = draw(id, place.orientation);
        if (drawn == null || drawn === false) return null;
        return (
          <FloatingBar key={id} id={id} place={place} layer={layerRef} dragging={view?.barId === id}>
            {drawn}
          </FloatingBar>
        );
      })}
    </div>
  );
}

const IGNORE = () => {};

function FloatingBar({ id, place, layer, dragging, children }: { id: string; place: FloatPlace; layer: RefObject<HTMLDivElement | null>; dragging: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // The dock's own drag moves the bar, so the hook only places it.
  const { style, placed } = useFloatingPlacement({ panelRef: ref, containerRef: layer, placement: place, onPlacementChange: IGNORE });
  const at = { '--dock-float-x': style.left, '--dock-float-y': style.top } as CSSProperties;
  return (
    <div ref={ref} className={s.floating} style={at} {...{ [DOCK_BAR]: id }} data-dock-floating="" data-placed={placed ? '' : undefined} data-dock-dragging={dragging ? '' : undefined}>
      {children}
    </div>
  );
}
