import type { createPointerStore } from '@weasel-js/core';
import type { TrialClock } from '../clock/trialClock';
import type { OverAccess } from '../config/over';
import type { RenderContext } from '../instrument/types';
import type { JobHandle } from '../job/types';
import type { TrialRecord } from '../state/types';
import type { useTrialToolSlot } from './useTrialToolSlot';

/** What an instrument's render context is made from. */
export interface RenderContextSources {
  record: TrialRecord;
  config: unknown;
  over: OverAccess | undefined;
  /** Write the trial's state, after snapshotting it. */
  setState: RenderContext['setState'];
  setConfig: RenderContext['setConfig'];
  showConfig: RenderContext['showConfig'];
  reportAuto: RenderContext['reportAuto'];
  emit: RenderContext['emit'];
  setView: (view: unknown) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  toolSlot: ReturnType<typeof useTrialToolSlot>['trial'];
  visibleLayers: string[];
  pointer: ReturnType<typeof createPointerStore>;
  clock: TrialClock | undefined;
  job: JobHandle | undefined;
}

/** The trial as its instrument's `render` sees it, and as `useTrialWriters` hands it to the trial's descendants. */
export function createRenderContext(src: RenderContextSources): RenderContext<unknown, unknown> {
  const { record, over, clock, job } = src;
  return {
    state: record.state,
    config: src.config,
    setState: src.setState,
    setConfig: src.setConfig,
    showConfig: src.showConfig,
    reportAuto: src.reportAuto,
    ...(over ? { over } : {}),
    trial: {
      id: record.id,
      view: record.view,
      setView: src.setView,
      zoom: src.zoom,
      setZoom: src.setZoom,
      ...src.toolSlot,
      visibleLayers: src.visibleLayers,
      pointer: src.pointer,
      ...(clock ? { clock } : {}),
    },
    emit: src.emit,
    job,
  };
}
