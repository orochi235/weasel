import { createPointerStore, PointerContextProvider, WeaselProvider } from '@weasel-js/core';
import { memo, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand/react';
import { AnnotationsContext } from '../annotations/AnnotationsContext';
import { AnnotationTargets } from '../annotations/AnnotationTargets';
import type { CameraView } from '../canvas/CameraInput';
import { CameraWheelContext, type CameraWheelSlot } from '../canvas/CameraWheelContext';
import { CanvasStack } from '../canvas/CanvasStack';
import { CameraPublishContext, CameraRegistryContext } from '../canvas/cameraRegistry';
import type { TrialContribution } from '../chrome/types';
import { TrialClockContext, TrialRootContext } from '../clock/contexts';
import { useTrialClockSetup } from '../clock/useTrialClockSetup';
import { useAutoReports } from '../config/autoReports';
import { useOverAccess } from '../config/over';
import { useConfigSchema } from '../config/useConfigSchema';
import { useResolvedConfig } from '../config/useResolvedConfig';
import { DragOverlay, useDragDrop } from '../dragdrop/DragDropRuntime';
import { withDragFeedback } from '../dragdrop/feedbackLayer';
import { Palette } from '../dragdrop/Palette';
import type { Instrument, InstrumentList, PaletteItem, RenderContext } from '../instrument/types';
import { undoCapability } from '../instrument/undo';
import { useLabCommands } from '../lab/LabContext';
import { PresentedTransport } from '../lab/PresentedTransport';
import { LabStoreContext, TrialIdProvider } from '../state/context';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { DEFAULT_VIEW } from '../state/view';
import { resolveLabTool } from '../tools/labTool';
import { LoupeSwitchContext, useLoupeSwitch } from './loupeSwitch';
import { MissingTrial } from './MissingTrial';
import { TrialChrome, type TrialChromeOptions } from './TrialChrome';
import { TrialLayerList, useTrialLayerState } from './TrialLayerList';
import { TrialHistoryContext, useHistoryVersion, useMountedHistory } from './trialHistory';
import { useKeptMarks } from './useKeptMarks';
import { TrialOrbitProvider } from './useOrbitView';
import { useTrialCamera } from './useTrialCamera';
import { useTrialJob } from './useTrialJob';
import { useTrialLayers } from './useTrialLayers';
import { useTrialMarks } from './useTrialMarks';
import { useTrialUndo } from './useTrialUndo';
import { useTrialWrites } from './useTrialWrites';

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
  const wheelSlot = useRef<CameraWheelSlot['current']>(null);
  const cameras = useContext(CameraRegistryContext);
  const trialId = record.id;
  const isLast = useStore(store, (s) => s.trials.length <= 1);
  const publishCamera = useMemo(
    () => (cameras ? (camera: CameraView) => cameras.register(trialId, camera) : null),
    [cameras, trialId],
  );
  const [pointer] = useState(createPointerStore);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const updateTrialState = useStore(store, (s) => s.updateTrialState);
  const updateTrialView = useStore(store, (s) => s.updateTrialView);
  const updateTrialAnnotations = useStore(store, (s) => s.updateTrialAnnotations);
  const labToolId = useStore(store, (s) => s.activeToolId);
  const setLabTool = useStore(store, (s) => s.setLabTool);
  const setTrialTool = useStore(store, (s) => s.setTrialTool);

  // Everything below reads `config`; `record.config` is the panel's view, and
  // reaches it through `record` on `TrialChrome`.
  const schema = useConfigSchema(instrument);
  const { config, auto } = useResolvedConfig(schema, record.config, record.auto);
  const { reports, report: reportAuto } = useAutoReports(auto);
  const over = useOverAccess(schema.over);

  const { layerVisibility, layerOrder, setOrder, setShown } = useTrialLayerState();
  const { loupeSwitch, loupeBindings } = useLoupeSwitch();

  const rootRef = useRef<HTMLElement | null>(null);
  const clockTarget = useCallback(() => rootRef.current, []);
  const { handle: clockHandle, provided: providedClock } = useTrialClockSetup({
    instrument,
    config,
    record,
    store,
    target: clockTarget,
  });
  const ticks = useMemo(
    () => (clockHandle ? (fn: () => void) => clockHandle.onFrame(() => fn()) : undefined),
    [clockHandle],
  );

  const { visibleLayers, canvasLayers, layerDescriptors, layerItems } = useTrialLayers({
    instrument,
    state: record.state,
    config,
    over,
    layerVisibility,
    layerOrder,
    clock: clockHandle?.clock,
  });

  const { mount: mountHistory, ...mounted } = useMountedHistory();
  const { snapshot: snapshotIfNeeded, setConfig } = useTrialWrites({
    store,
    trialId: record.id,
    instrument,
    schema,
    mounted,
  });

  const setView = (v: unknown): void => updateTrialView(record.id, v);

  const cam = useTrialCamera({
    instrument,
    trialId: record.id,
    view: record.view,
    setView,
    canvasHost: canvasContainerRef,
  });
  const { camera, view2d } = cam;

  const annotationsCap = useLabCommands().marks ? instrument.annotations : undefined;
  const {
    annotations,
    provided,
    moves: markMoves,
  } = useTrialMarks({
    record,
    config,
    capability: instrument.annotations,
    keptMarks,
    save: updateTrialAnnotations,
  });

  // A trial gets its own slot when its instrument declares tools; otherwise it
  // reads the lab's. Which slot a change writes follows from the same thing.
  // Annotation tools always read the lab's: a tool is what the hand holds, so
  // picking one arms it in every trial, the way artboards share a tool. They
  // were once per trial, back when one trial compared several pictures.
  const declaresTools = instrument.tools != null;
  const labTool = resolveLabTool(labToolId, instruments);
  const resolvedToolId = declaresTools
    ? (record.activeToolId ?? instrument.tools?.initial ?? instrument.tools?.tools[0]?.id ?? null)
    : labTool;
  const setActiveTool = (id: string): void => {
    if (declaresTools) setTrialTool(record.id, id);
    else setLabTool(id);
  };

  const job = useTrialJob({
    store,
    trialId,
    capability: instrument.job,
    config,
    state: record.state,
  });

  const renderCtx: RenderContext<unknown, unknown> = {
    state: record.state,
    config,
    setState: (next) => {
      snapshotIfNeeded('state.change');
      updateTrialState(record.id, next);
    },
    setConfig,
    reportAuto,
    ...(over ? { over } : {}),
    trial: {
      id: record.id,
      view: record.view,
      setView,
      zoom: cam.zoom,
      setZoom: cam.setZoom,
      activeToolId: resolvedToolId,
      setActiveTool,
      visibleLayers,
      pointer,
      ...(clockHandle ? { clock: clockHandle.clock } : {}),
    },
    emit: snapshotIfNeeded,
    job,
  };

  // Marks are undone through weasel history, not through labkit's snapshot
  // stack — the spec's rule, and the reason a mark scene is the truth.
  const snapshots = useHistoryVersion(record.history);
  const undoBindings = useTrialUndo({
    declaresUndo: undoCapability(instrument) != null,
    marks: annotationsCap ? { moves: markMoves, store: annotations } : null,
    own: mounted.history,
    snapshots,
  });

  const dragDropResult = useDragDrop({
    capability: instrument.dragDrop ?? { palette: [], onDrop: (_p, _i, s) => s },
    state: record.state,
    config,
    setState: (next) => updateTrialState(record.id, next as never),
    // A drop is announced before it lands, so this snapshot holds the state from before it.
    emit: (event) => snapshotIfNeeded(event) || snapshotIfNeeded('state.change'),
  });

  const paletteItems: PaletteItem[] = useMemo(() => {
    if (!instrument.dragDrop) return [];
    const p = instrument.dragDrop.palette;
    return typeof p === 'function' ? p(record.state, config) : p;
  }, [instrument.dragDrop, record.state, config]);

  const layersWithFeedback = useMemo(
    () => withDragFeedback(canvasLayers, dragDropResult.drag, canvasContainerRef),
    [canvasLayers, dragDropResult.drag],
  );

  let body: ReactNode;
  if (camera?.kind === 'canvas') {
    const canvas = camera.capability;
    body = (
      <div ref={canvasContainerRef} className="lk-trial__canvas-host">
        <CanvasStack
          layers={layersWithFeedback}
          view={view2d ?? DEFAULT_VIEW}
          onViewChange={setView}
          worldSpec={canvas.worldSpec}
          onResize={cam.placement.place}
          minZoom={canvas.minZoom}
          maxZoom={canvas.maxZoom}
          ticks={ticks}
          gestures={cam.gestures}
          onHome={cam.home}
        >
          {instrument.render(renderCtx)}
          {instrument.dragDrop ? dragDropResult.target : null}
        </CanvasStack>
        <DragOverlay drag={dragDropResult.drag} />
      </div>
    );
  } else if (camera) {
    body = cam.body(instrument.render(renderCtx), renderCtx);
  } else {
    body = instrument.render(renderCtx);
  }

  const startDrag = dragDropResult.startDrag;
  const paletteNode = useMemo(
    () =>
      paletteItems.length > 0 ? <Palette items={paletteItems} onDragStart={startDrag} /> : null,
    [paletteItems, startDrag],
  );

  const layerListNode = useMemo(
    () =>
      instrument.layers && layerDescriptors.length > 0 ? (
        <TrialLayerList
          items={layerItems}
          snapshot={snapshotIfNeeded}
          setOrder={setOrder}
          setVisibility={setShown}
        />
      ) : null,
    [instrument.layers, layerDescriptors, layerItems, snapshotIfNeeded, setOrder, setShown],
  );

  const extraChrome = useMemo<TrialContribution[]>(() => {
    const out: TrialContribution[] = [];
    if (paletteNode) {
      out.push({
        id: 'dragdrop-palette',
        region: 'sidebar',
        item: { title: 'Parts', body: paletteNode },
      });
    }
    if (layerListNode) {
      out.push({
        id: 'layer-list',
        region: 'sidebar',
        item: { title: 'Layers', body: layerListNode },
      });
    }
    return out;
  }, [paletteNode, layerListNode]);

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
      activeToolId={labTool}
    />
  ) : null;

  // The trial's root registries, isolated from the trial beside it. Each
  // camera inside mounts an input scope under them; chrome here reaches the
  // one last used. The pointer store is the trial's, shared by all of them.
  const scopedBody = (
    <WeaselProvider isolate>
      <PointerContextProvider store={pointer}>
        <CameraPublishContext.Provider value={publishCamera}>
          <LoupeSwitchContext.Provider value={loupeSwitch}>
            <TrialHistoryContext.Provider value={mountHistory}>{body}</TrialHistoryContext.Provider>
          </LoupeSwitchContext.Provider>
        </CameraPublishContext.Provider>
      </PointerContextProvider>
    </WeaselProvider>
  );

  return (
    <TrialIdProvider trialId={record.id} writes={renderCtx}>
      <TrialOrbitProvider orbit={cam.orbit} instrument={instrument} trialId={record.id}>
        <TrialClockContext.Provider value={providedClock}>
          <TrialRootContext.Provider value={rootRef}>
            <AnnotationsContext.Provider value={instrument.annotations ? provided : null}>
              <CameraWheelContext.Provider value={wheelSlot}>
                <TrialChrome
                  job={job}
                  loupe={loupeBindings}
                  trialId={record.id}
                  record={record}
                  instrument={instrument}
                  isLastTrial={isLast}
                  undoBindings={undoBindings}
                  setConfig={setConfig}
                  reported={reports}
                  trialChrome={extraChrome}
                  {...options}
                  activeToolId={resolvedToolId}
                  setActiveTool={setActiveTool}
                >
                  {scopedBody}
                  {annotationOverlays}
                  <PresentedTransport trialId={record.id} />
                </TrialChrome>
              </CameraWheelContext.Provider>
            </AnnotationsContext.Provider>
          </TrialRootContext.Provider>
        </TrialClockContext.Provider>
      </TrialOrbitProvider>
    </TrialIdProvider>
  );
}
