import { type ReactNode, type RefObject, useMemo } from 'react';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { type UseDragDropResult, useDragDrop } from '../dragdrop/DragDropRuntime';
import { withDragFeedback } from '../dragdrop/feedbackLayer';
import { Palette } from '../dragdrop/Palette';
import type { Instrument, PaletteItem } from '../instrument/types';

/** What a trial's drag and drop reads and writes. */
export interface TrialDragDropSources {
  instrument: Instrument;
  state: unknown;
  config: unknown;
  setState: (next: unknown) => void;
  /** The trial's snapshot-if-needed: true when it took one for `event`. */
  snapshot: (event: string) => boolean;
  /** The canvas layers a drag's feedback is drawn over. */
  canvasLayers: CanvasLayerDescriptor[];
  /** The element the trial's canvas sits in, which feedback is placed against. */
  canvasHost: RefObject<HTMLElement | null>;
}

/** A trial's drag and drop from its instrument's palette: the live drag, its canvas layers with the drag's
 *  feedback drawn over them, and the palette to drag from, or null for an instrument with nothing in it. */
export function useTrialDragDrop({
  instrument,
  state,
  config,
  setState,
  snapshot,
  canvasLayers,
  canvasHost,
}: TrialDragDropSources): {
  dragDrop: UseDragDropResult;
  layers: CanvasLayerDescriptor[];
  palette: ReactNode;
} {
  const dragDrop = useDragDrop({
    capability: instrument.dragDrop ?? { palette: [], onDrop: (_p, _i, s) => s },
    state,
    config,
    setState,
    // A drop is announced before it lands, so this snapshot holds the state from before it.
    emit: (event) => snapshot(event) || snapshot('state.change'),
  });

  const paletteItems: PaletteItem[] = useMemo(() => {
    if (!instrument.dragDrop) return [];
    const p = instrument.dragDrop.palette;
    return typeof p === 'function' ? p(state, config) : p;
  }, [instrument.dragDrop, state, config]);

  const layers = useMemo(
    () => withDragFeedback(canvasLayers, dragDrop.drag, canvasHost),
    [canvasLayers, dragDrop.drag, canvasHost],
  );

  const startDrag = dragDrop.startDrag;
  const palette = useMemo(
    () =>
      paletteItems.length > 0 ? <Palette items={paletteItems} onDragStart={startDrag} /> : null,
    [paletteItems, startDrag],
  );
  return { dragDrop, layers, palette };
}
