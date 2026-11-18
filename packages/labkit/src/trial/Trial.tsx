import { createPointerStore } from '@weasel-js/core';
import { memo, useContext, useRef, useState } from 'react';
import { useStore } from 'zustand/react';
import { AnnotationTargets } from '../annotations/AnnotationTargets';
import type { Instrument, InstrumentList } from '../instrument/types';
import { useLabCommands } from '../lab/LabContext';
import { PresentedTransport } from '../lab/PresentedTransport';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { useLoupeSwitch } from './loupeSwitch';
import { MissingTrial } from './MissingTrial';
import { createRenderContext } from './renderContext';
import { TrialChrome, type TrialChromeOptions } from './TrialChrome';
import { TrialBodyScope, TrialContexts } from './TrialContexts';
import { createTrialActions } from './TrialScope';
import { renderTrialContent } from './trialContent';
import { useKeptMarks } from './useKeptMarks';
import { useRuntimeSections } from './useRuntimeSections';
import { useTrialCamera } from './useTrialCamera';
import { useTrialClock } from './useTrialClock';
import { useTrialConfig } from './useTrialConfig';
import { useTrialDragDrop } from './useTrialDragDrop';
import { useTrialEdits } from './useTrialEdits';
import { useTrialJob } from './useTrialJob';
import { useTrialLayerStack } from './useTrialLayerStack';
import { useTrialTool } from './useTrialTool';

/** Props for `<Trial>`: the trial, and how the lab dresses its chrome. */
export interface TrialProps extends TrialChromeOptions {
  id: string;
}

/** Renders one trial from the lab store: looks up its record and
 *  instrument, and mounts the instrument inside the trial chrome. */
export const Trial = memo(function Trial({ id, ...options }: TrialProps) {
  const lab = useLabCommands();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] <Trial> requires <LabStoreProvider>');
  const instruments = useStore(storeCtx.store, (s) => s.instruments) ?? lab.instruments;
  const record = useStore(storeCtx.store, (s) => s.trials.find((w) => w.id === id));
  const instrument = record ? instruments.find((i) => i.name === record.instrumentName) : undefined;
  const kept = useKeptMarks(instrument?.annotations?.storage, id);
  if (!record) return <MissingTrial id={id}>{`Trial not found: ${id}`}</MissingTrial>;
  if (!instrument)
    return <MissingTrial id={id}>{`Unknown instrument: ${record.instrumentName}`}</MissingTrial>;
  if (!kept.ready) return <div className="lk-trial lk-trial--loading" />;
  return (
    <TrialRuntime
      keptMarks={kept.value}
      record={record}
      instrument={instrument}
      instruments={instruments}
      store={storeCtx.store}
      options={options}
    />
  );
});

interface TrialRuntimeProps {
  /** The marks an instrument's own `AnnotationStorage` loaded. */
  keptMarks: unknown;
  record: TrialRecord;
  instrument: Instrument;
  /** The lab's instruments as the store holds them now. */
  instruments: InstrumentList;
  store: LabStore;
  options: TrialChromeOptions;
}

function TrialRuntime({
  keptMarks,
  record,
  instrument,
  instruments,
  store,
  options,
}: TrialRuntimeProps) {
  const trialId = record.id;
  const isLast = useStore(store, (s) => s.trials.length <= 1);
  const [pointer] = useState(createPointerStore);
  const [actions] = useState(createTrialActions);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const updateTrialState = useStore(store, (s) => s.updateTrialState);
  const updateTrialView = useStore(store, (s) => s.updateTrialView);

  const { schema, config, reports, reportAuto, over } = useTrialConfig(instrument, record);
  const { loupeSwitch, loupeBindings } = useLoupeSwitch();

  const clock = useTrialClock({ instrument, config, record, store });

  const setView = (v: unknown): void => updateTrialView(record.id, v);

  const cam = useTrialCamera({
    instrument,
    trialId: record.id,
    view: record.view,
    setView,
    canvasHost: canvasContainerRef,
  });

  const annotationsCap = useLabCommands().marks ? instrument.annotations : undefined;
  const edits = useTrialEdits({
    store,
    record,
    instrument,
    schema,
    config,
    keptMarks,
    shownMarks: annotationsCap,
  });
  const { snapshot: snapshotIfNeeded, writes, annotations, mounted } = edits;

  const layerStack = useTrialLayerStack({
    instrument,
    state: record.state,
    config,
    over,
    clock: clock.handle?.clock,
    snapshot: snapshotIfNeeded,
  });

  const tool = useTrialTool(store, instrument, instruments, record);

  const job = useTrialJob({
    store,
    trialId,
    capability: instrument.job,
    config,
    state: record.state,
  });

  const renderCtx = createRenderContext({
    record,
    config,
    over,
    setState: (next) => {
      snapshotIfNeeded('state.change');
      updateTrialState(record.id, next);
    },
    setConfig: writes.setConfig,
    reportAuto,
    emit: snapshotIfNeeded,
    setView,
    zoom: cam.zoom,
    setZoom: cam.setZoom,
    toolSlot: tool.slot.trial,
    visibleLayers: layerStack.visibleLayers,
    pointer,
    clock: clock.handle?.clock,
    job,
  });

  const { dragDrop, layers, palette } = useTrialDragDrop({
    instrument,
    state: record.state,
    config,
    setState: (next) => updateTrialState(record.id, next as never),
    snapshot: snapshotIfNeeded,
    canvasLayers: layerStack.canvasLayers,
    canvasHost: canvasContainerRef,
  });

  const body = renderTrialContent({
    instrument,
    ctx: renderCtx,
    cam,
    layers,
    dragDrop,
    canvasHost: canvasContainerRef,
    ticks: clock.ticks,
    setView,
  });

  const extraChrome = useRuntimeSections(palette, layerStack.list);

  // Rendered beside the body rather than inside it: an overlay portals itself
  // into the surface container, so where it sits in this tree decides only
  // when its effects run — after the instrument's refs have attached.
  const annotationOverlays = annotationsCap ? (
    <AnnotationTargets
      capability={annotationsCap}
      state={record.state}
      config={config}
      trial={{ id: record.id, view: record.view }}
      annotations={annotations}
      activeToolId={tool.labTool}
    />
  ) : null;

  return (
    <TrialContexts
      trialId={record.id}
      writes={renderCtx}
      orbit={cam.orbit}
      instrument={instrument}
      clock={clock.provided}
      root={clock.root}
      annotations={instrument.annotations ? edits.provided : null}
    >
      <TrialChrome
        job={job}
        loupe={loupeBindings}
        trialId={record.id}
        record={record}
        instrument={instrument}
        isLastTrial={isLast}
        undoBindings={edits.undoBindings}
        {...writes}
        reported={reports}
        trialChrome={extraChrome}
        {...options}
        toolSlot={tool.slot.chrome}
        actions={actions}
      >
        <TrialBodyScope
          trialId={record.id}
          pointer={pointer}
          actions={actions}
          loupeSwitch={loupeSwitch}
          mounted={mounted}
        >
          {body}
        </TrialBodyScope>
        {annotationOverlays}
        <PresentedTransport trialId={record.id} />
      </TrialChrome>
    </TrialContexts>
  );
}
