import type { ReactNode } from 'react';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import type { TrialContribution } from '../chrome/types';
import { renderTrialContent, type TrialContentSources } from './trialContent';
import { useRuntimeSections } from './useRuntimeSections';
import { useTrialDragDrop } from './useTrialDragDrop';

/** What a trial's body is drawn from: its content's sources, less the drag and drop this makes. */
export interface TrialBodySources extends Omit<TrialContentSources, 'layers' | 'dragDrop'> {
  state: unknown;
  config: unknown;
  setState: (next: unknown) => void;
  snapshot: (event: string) => boolean;
  /** The trial's layers, and the list that shows and orders them. */
  layerStack: { canvasLayers: CanvasLayerDescriptor[]; list: ReactNode };
}

/** A trial's body: its content with the drag and drop from its instrument's palette, and the chrome the runtime
 *  adds for it, the palette and the layer list. */
export function useTrialBody({
  state,
  config,
  setState,
  snapshot,
  layerStack,
  ...content
}: TrialBodySources): { body: ReactNode; extraChrome: TrialContribution[] } {
  const { dragDrop, layers, palette } = useTrialDragDrop({
    instrument: content.instrument,
    state,
    config,
    setState,
    snapshot,
    canvasLayers: layerStack.canvasLayers,
    canvasHost: content.canvasHost,
  });
  const body = renderTrialContent({ ...content, layers, dragDrop });
  return { body, extraChrome: useRuntimeSections(palette, layerStack.list) };
}
