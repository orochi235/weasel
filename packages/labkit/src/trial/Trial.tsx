import {
  createPointerStore,
  type History,
  PointerContextProvider,
  WeaselProvider,
} from '@weasel-js/core';
import {
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useStore } from 'zustand/react';
import { AnnotationsContext } from '../annotations/AnnotationsContext';
import { AnnotationTargets } from '../annotations/AnnotationTargets';
import type { CameraView } from '../canvas/CameraInput';
import { CameraWheelContext, type CameraWheelSlot } from '../canvas/CameraWheelContext';
import { CanvasStack } from '../canvas/CanvasStack';
import { CameraPublishContext, CameraRegistryContext } from '../canvas/cameraRegistry';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { applyCamera } from '../canvas/worldSpec';
import type { TrialContribution } from '../chrome/types';
import { TrialClockContext, TrialRootContext } from '../clock/contexts';
import { useTrialClockSetup } from '../clock/useTrialClockSetup';
import { useConfigSchema } from '../config/useConfigSchema';
import { useResolvedConfig } from '../config/useResolvedConfig';
import { DragOverlay, useDragDrop } from '../dragdrop/DragDropRuntime';
import { Palette } from '../dragdrop/Palette';
import type {
  Instrument,
  InstrumentList,
  LayerDescriptor,
  PaletteItem,
  RenderContext,
} from '../instrument/types';
import { useJob } from '../job/useJob';
import { useLabCommands } from '../lab/LabContext';
import { PresentedTransport } from '../lab/PresentedTransport';
import type { LayerListItem } from '../passthrough/weasel-ui';
import { LabStoreContext, TrialIdProvider } from '../state/context';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { DEFAULT_VIEW } from '../state/view';
import { resolveLabTool } from '../tools/labTool';
import { LoupeSwitchContext } from './loupeSwitch';
import { MissingTrial } from './MissingTrial';
import type { LoupeBindings } from './TrialChrome';
import { TrialChrome } from './TrialChrome';
import { TrialLayerList, useTrialLayerState } from './TrialLayerList';
import { TrialHistoryContext, useMountedHistory } from './trialHistory';
import { trialUndoBindings } from './trialUndo';
import { useKeptMarks } from './useKeptMarks';
import { TrialOrbitProvider } from './useOrbitView';
import { useTrialCamera } from './useTrialCamera';
import { useTrialMarks } from './useTrialMarks';
import { useTrialWrites } from './useTrialWrites';

/** Props for `<Trial>`. */
export interface TrialProps {
  id: string;
  /** Contributions the lab adds to this trial's chrome, merged after the
   *  instrument's own. */
  chrome?: readonly TrialContribution[];
  /** Built-in contribution ids to drop. Throws on an id that is not there. */
  suppress?: readonly string[];
}

/** Renders one trial from the lab store: looks up its record and
 *  instrument, and mounts the instrument inside the trial chrome. */
export const Trial = memo(function Trial({ id, chrome, suppress }: TrialProps) {
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
      chrome={chrome}
      suppress={suppress}
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
  chrome?: readonly TrialContribution[];
  suppress?: readonly string[];
}

function TrialRuntime({
  keptMarks,
  record,
  instrument,
  instruments,
  store,
  chrome,
  suppress,
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
  const { config } = useResolvedConfig(schema, record.config, record.auto);

  const { layerVisibility, layerOrder, setOrder, setShown } = useTrialLayerState();
  const [loupeOn, setLoupeOn] = useState(false);
  const [lenses, setLenses] = useState(0);
  const mountLens = useCallback(() => {
    setLenses((n) => n + 1);
    return () => setLenses((n) => n - 1);
  }, []);
  const loupeSwitch = useMemo(() => ({ on: loupeOn, mount: mountLens }), [loupeOn, mountLens]);

  const visibleLayers = useMemo(
    () =>
      (instrument.canvas?.layers ?? [])
        .filter((l) => layerVisibility[l.id] !== false)
        .map((l) => l.id),
    [instrument.canvas, layerVisibility],
  );

  const rootRef = useRef<HTMLElement | null>(null);
  const clockTarget = useCallback(() => rootRef.current, []);
  const clockHandle = useTrialClockSetup({ instrument, config, record, store, target: clockTarget });
  const ticks = useMemo(
    () => (clockHandle ? (fn: () => void) => clockHandle.onFrame(() => fn()) : undefined),
    [clockHandle],
  );

  const undoCap = instrument.undo;
  const { snapshot: snapshotIfNeeded, setConfig } = useTrialWrites({
    store,
    trialId: record.id,
    instrument,
    schema,
  });

  const { mount: mountHistory, history: ownHistory, holds: holdsHistory } = useMountedHistory();
  const snapshotState = (event: string): void => {
    if (!holdsHistory()) snapshotIfNeeded(event);
  };

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

  const jobCap = instrument.job;
  // Hooks cannot be conditional, so a trial without the capability still calls
  // this — with a runner that yields nothing and is never started.
  const job = useJob({
    capability: jobCap ?? { run: async function* () {}, onItem: (_i, st) => st },
    config,
    state: record.state,
    setState: (next) => updateTrialState(record.id, next as never),
  });

  const renderCtx: RenderContext<unknown, unknown> = {
    state: record.state,
    config,
    setState: (next) => {
      snapshotState('state.change');
      updateTrialState(record.id, next);
    },
    setConfig,
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
    emit: snapshotState,
    job: jobCap ? job : undefined,
  };

  // Marks are undone through weasel history, not through labkit's snapshot
  // stack — the spec's rule, and the reason a mark scene is the truth.
  const snapshots = useHistoryVersion(record.history);
  const undoBindings = trialUndoBindings({
    declaresUndo: undoCap != null,
    marks: annotationsCap
      ? { moves: markMoves, undo: () => annotations.undo(), redo: () => annotations.redo() }
      : null,
    own: ownHistory,
    snapshots,
  });

  const loupeBindings: LoupeBindings | undefined =
    lenses > 0 ? { on: loupeOn, toggle: () => setLoupeOn((v) => !v) } : undefined;

  const canvasLayers: CanvasLayerDescriptor[] = useMemo(() => {
    if (!instrument.canvas) return [];
    const baseLayers = instrument.canvas.layers;
    const ordered = layerOrder
      ? [...baseLayers].sort((a, b) => layerOrder.indexOf(a.id) - layerOrder.indexOf(b.id))
      : baseLayers;
    const clock = clockHandle?.clock;
    return ordered.map((layer) => ({
      id: layer.id,
      visible: layerVisibility[layer.id] !== false,
      timed: layer.timed === true,
      render: (ctx, view, frame) => {
        // Camera applied here, so a layer draws in world coordinates. `zoom`
        // stays in the args for line widths, which must not scale with it.
        applyCamera(ctx, view, frame);
        layer.draw(ctx, {
          state: record.state,
          config,
          zoom: view.zoom,
          elapsed: clock?.elapsed ?? 0,
          pass: clock?.pass ?? 0,
          phase: clock?.phase ?? 0,
        });
      },
    }));
  }, [instrument.canvas, record.state, config, layerVisibility, layerOrder, clockHandle]);

  const layerDescriptors: LayerDescriptor[] = useMemo(() => {
    if (!instrument.layers) return [];
    return instrument.layers.ids.map((l) => (typeof l === 'string' ? { id: l, label: l } : l));
  }, [instrument.layers]);

  // In the order the canvas draws them, with the always-on layers pinned
  // below the rest, where a drag cannot reach past them.
  const layerItems: LayerListItem[] = useMemo(() => {
    const ordered = layerOrder
      ? [...layerDescriptors].sort((a, b) => layerOrder.indexOf(a.id) - layerOrder.indexOf(b.id))
      : layerDescriptors;
    const pinnedLast = [
      ...ordered.filter((l) => !l.alwaysOn),
      ...ordered.filter((l) => l.alwaysOn),
    ];
    return pinnedLast.map((l) => ({
      id: l.id,
      label: l.label,
      fixed: l.alwaysOn === true,
      visible: l.alwaysOn === true || layerVisibility[l.id] !== false,
    }));
  }, [layerDescriptors, layerOrder, layerVisibility]);

  const dragDropResult = useDragDrop({
    capability: instrument.dragDrop ?? { palette: [], onDrop: (_p, _i, s) => s },
    state: record.state,
    config,
    setState: (next) => {
      snapshotIfNeeded('canvas.itemAdded');
      updateTrialState(record.id, next as never);
    },
    emit: snapshotIfNeeded,
  });

  const paletteItems: PaletteItem[] = useMemo(() => {
    if (!instrument.dragDrop) return [];
    const p = instrument.dragDrop.palette;
    return typeof p === 'function' ? p(record.state, config) : p;
  }, [instrument.dragDrop, record.state, config]);

  const layersWithFeedback: CanvasLayerDescriptor[] = useMemo(() => {
    if (!dragDropResult.drag?.feedback) return canvasLayers;
    const fb = dragDropResult.drag.feedback;
    const screen = dragDropResult.drag.screenPos;
    return [
      ...canvasLayers,
      {
        id: '__lk_drag_feedback',
        visible: true,
        render: (ctx) => {
          const el = canvasContainerRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          ctx.save();
          ctx.strokeStyle = fb.ok ? '#3a7' : '#c44';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(screen.x - r.left, screen.y - r.top, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        },
      },
    ];
  }, [canvasLayers, dragDropResult.drag]);

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
    <TrialIdProvider trialId={record.id}>
      <TrialOrbitProvider orbit={cam.orbit} instrument={instrument} trialId={record.id}>
        <TrialClockContext.Provider value={clockHandle}>
          <TrialRootContext.Provider value={rootRef}>
            <AnnotationsContext.Provider value={instrument.annotations ? provided : null}>
              <CameraWheelContext.Provider value={wheelSlot}>
                <TrialChrome
                  job={jobCap ? job : undefined}
                  loupe={loupeBindings}
                  trialId={record.id}
                  record={record}
                  instrument={instrument}
                  isLastTrial={isLast}
                  undoBindings={undoBindings}
                  setConfig={setConfig}
                  trialChrome={extraChrome}
                  chrome={chrome}
                  suppress={suppress}
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

const NO_SUBSCRIBE = () => () => {};

/** `history`, re-rendering the caller whenever it changes. */
function useHistoryVersion(history: History | undefined): History | undefined {
  useSyncExternalStore(history?.subscribe ?? NO_SUBSCRIBE, () => history?.getVersion() ?? 0);
  return history;
}
