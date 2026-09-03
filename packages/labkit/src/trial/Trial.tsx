import { type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand/react';
import { AnnotationsContext } from '../annotations/AnnotationsContext';
import { AnnotationTargets } from '../annotations/AnnotationTargets';
import { annotationsFromJSON } from '../annotations/store';
import type { AnnotationTargetInfo } from '../annotations/types';
import { CanvasStack } from '../canvas/CanvasStack';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { applyCamera, type ViewportSize } from '../canvas/worldSpec';
import type { TrialContribution } from '../chrome/types';
import { DragOverlay, useDragDrop } from '../dragdrop/DragDropRuntime';
import { Palette } from '../dragdrop/Palette';
import type { Instrument, LayerDescriptor, PaletteItem, RenderContext } from '../instrument/types';
import { useJob } from '../job/useJob';
import { useLabContext } from '../lab/LabContext';
import { LayerList } from '../layers/LayerList';
import { TrialLoupe } from '../loupe/TrialLoupe';
import { resolveLoupe } from '../loupe/types';
import { LabStoreContext, TrialIdProvider } from '../state/context';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { as2DView, DEFAULT_VIEW } from '../state/view';
import { createEventBus, type EventBus } from '../undo/eventBus';
import { pushSnapshot, redo as undoRedo, undo as undoUndo } from '../undo/undoStack';
import type { LoupeBindings, UndoBindings } from './TrialChrome';
import { TrialChrome } from './TrialChrome';

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
export function Trial({ id, chrome, suppress }: TrialProps) {
  const lab = useLabContext();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] <Trial> requires <LabStoreProvider>');
  const record = useStore(storeCtx.store, (s) => s.trials.find((w) => w.id === id));
  if (!record) {
    return <div className="lk-trial lk-trial--unknown">Trial not found: {id}</div>;
  }
  const instrument = lab.instruments.find((i) => i.name === record.instrumentName);
  if (!instrument) {
    return (
      <div className="lk-trial lk-trial--unknown">Unknown instrument: {record.instrumentName}</div>
    );
  }
  return (
    <TrialRuntime
      record={record}
      instrument={instrument}
      store={storeCtx.store}
      isLast={lab.trials.length <= 1}
      chrome={chrome}
      suppress={suppress}
    />
  );
}

interface TrialRuntimeProps {
  record: TrialRecord;
  instrument: Instrument;
  store: LabStore;
  isLast: boolean;
  chrome?: readonly TrialContribution[];
  suppress?: readonly string[];
}

function TrialRuntime({ record, instrument, store, isLast, chrome, suppress }: TrialRuntimeProps) {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const loupeHostRef = useRef<HTMLDivElement | null>(null);
  const updateTrialState = useStore(store, (s) => s.updateTrialState);
  const updateTrialConfig = useStore(store, (s) => s.updateTrialConfig);
  const updateTrialView = useStore(store, (s) => s.updateTrialView);
  const updateTrialUndoStack = useStore(store, (s) => s.updateTrialUndoStack);
  const updateTrialAnnotations = useStore(store, (s) => s.updateTrialAnnotations);
  const labToolId = useStore(store, (s) => s.activeToolId);
  const setLabTool = useStore(store, (s) => s.setLabTool);
  const setTrialTool = useStore(store, (s) => s.setTrialTool);

  const busRef = useRef<EventBus | null>(null);
  if (busRef.current === null) busRef.current = createEventBus();
  const bus = busRef.current;

  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [layerOrder, setLayerOrder] = useState<string[] | null>(null);
  const [loupeOn, setLoupeOn] = useState(false);

  const visibleLayers = useMemo(
    () =>
      (instrument.canvas?.layers ?? [])
        .filter((l) => layerVisibility[l.id] !== false)
        .map((l) => l.id),
    [instrument.canvas, layerVisibility],
  );

  const undoCap = instrument.undo;
  const undoEvents = useMemo(() => new Set(undoCap?.snapshotOn ?? ['state.change']), [undoCap]);
  const maxDepth = undoCap?.maxDepth ?? 50;

  const snapshotIfNeeded = (event: string): void => {
    if (!undoCap || !undoEvents.has(event)) return;
    const current = store.getState().trials.find((w) => w.id === record.id);
    if (!current) return;
    const snap = structuredClone(current.state);
    updateTrialUndoStack(record.id, (prev) => pushSnapshot(prev, snap, maxDepth));
  };

  const setView = (v: unknown): void => updateTrialView(record.id, v);

  // A function `initialView` needs the canvas size, so `trialOps` leaves the
  // view null and the first measurement resolves it. Reset nulls it again,
  // which re-frames — so the guard is the null itself, not a "have I run" flag.
  const placeView = (size: ViewportSize): void => {
    const declared = instrument.canvas?.initialView;
    if (typeof declared !== 'function') return;
    if (record.view != null) return;
    setView(declared(size));
  };

  // The capability's own `targets` thunk, re-read on every call: a target
  // resizing or gaining a dependency must not need the store rebuilt. Held in
  // a ref because the store is built once and closes over it.
  const annotationsCap = instrument.annotations;
  const targetsRef = useRef<() => readonly AnnotationTargetInfo[]>(() => []);
  targetsRef.current = () =>
    annotationsCap ? annotationsCap.targets(record.state, record.config) : [];

  // One store for the trial's lifetime. Marks do not survive a reload yet —
  // the storage slot is 3d.
  const annotationsRef = useRef<ReturnType<typeof annotationsFromJSON> | null>(null);
  if (annotationsRef.current === null) {
    // Seeded from wherever the marks were kept: the instrument's own store if
    // it declared one, else this trial's slot.
    const kept = annotationsCap?.storage ? annotationsCap.storage.load() : record.annotations;
    annotationsRef.current = annotationsFromJSON(kept, () => targetsRef.current());
  }
  const annotations = annotationsRef.current;

  // Written on a trailing debounce rather than per notification: a scene
  // mutates every frame of a drag, and a zustand write per frame re-renders
  // every trial in the lab. The unmount flush is not an optimization — the
  // last mark before a trial closes is otherwise lost.
  const saveCap = annotationsCap?.storage;
  const saveRef = useRef<(doc: unknown) => void>(() => {});
  saveRef.current = (doc) => {
    if (saveCap) saveCap.save(doc as never);
    else updateTrialAnnotations(record.id, doc);
  };
  // Only when the pair flips, which is rare: bumping React state on every
  // scene notification would re-render the trial on every frame of a drag,
  // which is the thing the debounce below exists to avoid.
  const [markMoves, setMarkMoves] = useState({ undo: false, redo: false });
  useEffect(() => {
    if (!annotationsCap) return;
    const read = (): void => {
      const next = { undo: annotations.canUndo(), redo: annotations.canRedo() };
      setMarkMoves((prev) => (prev.undo === next.undo && prev.redo === next.redo ? prev : next));
    };
    read();
    return annotations.subscribe(read);
  }, [annotations, annotationsCap]);

  useEffect(() => {
    if (!annotationsCap) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;
    const flush = (): void => {
      if (!dirty) return;
      dirty = false;
      saveRef.current(annotations.toJSON());
    };
    const off = annotations.subscribe(() => {
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, 250);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
      flush();
    };
  }, [annotations, annotationsCap]);

  // A trial gets its own slot when its instrument declares tools; otherwise it
  // reads the lab's. Which slot a change writes follows from the same thing.
  // Annotation tools are a trial's own for the same reason: two trials
  // annotating different pictures must not share one active tool.
  const declaresTools = instrument.tools != null || instrument.annotations != null;
  const resolvedToolId = declaresTools
    ? (record.activeToolId ??
      instrument.tools?.initial ??
      instrument.tools?.tools[0]?.id ??
      (instrument.annotations ? 'select' : null))
    : labToolId;
  const setActiveTool = (id: string): void => {
    if (declaresTools) setTrialTool(record.id, id);
    else setLabTool(id);
  };

  // `CanvasStack` and the zoom controls are 2D; a trial holding another view shape
  // gets the default here and simply never renders them.
  const view2d = as2DView(record.view);

  const jobCap = instrument.job;
  // Hooks cannot be conditional, so a trial without the capability still calls
  // this — with a runner that yields nothing and is never started.
  const job = useJob({
    capability: jobCap ?? { run: async function* () {}, onItem: (_i, st) => st },
    config: record.config,
    state: record.state,
    setState: (next) => updateTrialState(record.id, next as never),
  });

  const renderCtx: RenderContext<unknown, unknown> = {
    state: record.state,
    config: record.config,
    setState: (next) => {
      snapshotIfNeeded('state.change');
      updateTrialState(record.id, next);
      bus.emit('state.change');
    },
    setConfig: (key, value) => {
      const evt = `config.change:${String(key)}`;
      snapshotIfNeeded('config.change');
      snapshotIfNeeded(evt);
      updateTrialConfig(record.id, key as never, value as never);
      bus.emit('config.change');
      bus.emit(evt);
    },
    trial: {
      id: record.id,
      view: record.view,
      setView,
      zoom: view2d?.zoom ?? 1,
      setZoom: (z) => {
        if (!view2d) return;
        updateTrialView(record.id, { ...view2d, zoom: z });
      },
      activeToolId: resolvedToolId,
      visibleLayers,
    },
    emit: (event) => {
      snapshotIfNeeded(event);
      bus.emit(event);
    },
    job: jobCap ? job : undefined,
  };

  // Marks are undone through weasel history, not through labkit's snapshot
  // stack — the spec's rule, and the reason a mark scene is the truth. A trial
  // declaring both takes the marks first: the most recent thing the user did
  // is what undo is for, and only a mark change moves the mark history.
  const undoState = () => {
    const result = undoUndo(record.undoStack, structuredClone(record.state));
    if (!result) return;
    updateTrialState(record.id, result.snapshot as never);
    updateTrialUndoStack(record.id, result.stack);
  };
  const redoState = () => {
    const result = undoRedo(record.undoStack, structuredClone(record.state));
    if (!result) return;
    updateTrialState(record.id, result.snapshot as never);
    updateTrialUndoStack(record.id, result.stack);
  };

  const undoBindings: UndoBindings | undefined =
    undoCap || annotationsCap
      ? {
          canUndo: markMoves.undo || (undoCap ? record.undoStack.past.length > 0 : false),
          canRedo: markMoves.redo || (undoCap ? record.undoStack.future.length > 0 : false),
          undo: () => {
            if (annotationsCap && annotations.undo()) return;
            if (undoCap) undoState();
          },
          redo: () => {
            if (annotationsCap && annotations.redo()) return;
            if (undoCap) redoState();
          },
        }
      : undefined;

  const loupeCap = useMemo(() => {
    const declared = instrument.loupe;
    if (declared == null) return null;
    return resolveLoupe(typeof declared === 'function' ? declared(record.config) : declared);
  }, [instrument.loupe, record.config]);
  const loupeBindings: LoupeBindings | undefined = loupeCap
    ? { on: loupeOn, toggle: () => setLoupeOn((v) => !v) }
    : undefined;

  const canvasLayers: CanvasLayerDescriptor[] = useMemo(() => {
    if (!instrument.canvas) return [];
    const baseLayers = instrument.canvas.layers;
    const ordered = layerOrder
      ? [...baseLayers].sort((a, b) => layerOrder.indexOf(a.id) - layerOrder.indexOf(b.id))
      : baseLayers;
    return ordered.map((layer) => ({
      id: layer.id,
      visible: layerVisibility[layer.id] !== false,
      render: (ctx, view, frame) => {
        // Camera applied here, so a layer draws in world coordinates. `zoom`
        // stays in the args for line widths, which must not scale with it.
        applyCamera(ctx, view, frame);
        layer.draw(ctx, { state: record.state, config: record.config, zoom: view.zoom });
      },
    }));
  }, [instrument.canvas, record.state, record.config, layerVisibility, layerOrder]);

  const layerDescriptors: LayerDescriptor[] = useMemo(() => {
    if (!instrument.layers) return [];
    return instrument.layers.ids.map((l) => (typeof l === 'string' ? { id: l, label: l } : l));
  }, [instrument.layers]);

  const dragDropResult = useDragDrop({
    capability: instrument.dragDrop ?? { palette: [], onDrop: (_p, _i, s) => s },
    canvasContainerRef,
    view: view2d ?? DEFAULT_VIEW,
    worldSpec: instrument.canvas?.worldSpec,
    state: record.state,
    config: record.config,
    setState: (next) => {
      snapshotIfNeeded('canvas.itemAdded');
      updateTrialState(record.id, next as never);
    },
    emit: (evt) => {
      snapshotIfNeeded(evt);
      bus.emit(evt);
    },
  });

  const paletteItems: PaletteItem[] = useMemo(() => {
    if (!instrument.dragDrop) return [];
    const p = instrument.dragDrop.palette;
    return typeof p === 'function' ? p(record.state, record.config) : p;
  }, [instrument.dragDrop, record.state, record.config]);

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

  // The lens tracks the pointer over whatever box holds the content: the canvas
  // stack's own element, which it takes from context, or the wrapper below.
  const lens = loupeCap ? (
    <TrialLoupe
      capability={loupeCap}
      enabled={loupeOn}
      state={record.state}
      config={record.config}
      view={view2d ?? DEFAULT_VIEW}
      worldSpec={instrument.canvas?.worldSpec}
      hostRef={loupeHostRef}
    />
  ) : null;

  let body: ReactNode;
  if (instrument.canvas) {
    body = (
      <div ref={canvasContainerRef} className="lk-trial__canvas-host">
        <CanvasStack
          layers={layersWithFeedback}
          view={view2d ?? DEFAULT_VIEW}
          onViewChange={setView}
          worldSpec={instrument.canvas.worldSpec}
          onResize={placeView}
          minZoom={instrument.canvas.minZoom}
          maxZoom={instrument.canvas.maxZoom}
        >
          {instrument.render(renderCtx)}
          {lens}
        </CanvasStack>
        <DragOverlay drag={dragDropResult.drag} />
      </div>
    );
  } else if (lens) {
    body = (
      <div ref={loupeHostRef} className="lk-trial__loupe-host">
        {instrument.render(renderCtx)}
        {lens}
      </div>
    );
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
        <LayerList
          layers={layerDescriptors}
          visibility={layerVisibility}
          onReorder={(next) => {
            setLayerOrder(next.map((l) => l.id));
            bus.emit('layers.reorder');
          }}
          onToggle={(lid, visible) => {
            setLayerVisibility((prev) => ({ ...prev, [lid]: visible }));
            bus.emit('layers.toggle');
          }}
        />
      ) : null,
    [instrument.layers, layerDescriptors, layerVisibility, bus],
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
      config={record.config}
      annotations={annotations}
      activeToolId={resolvedToolId}
    />
  ) : null;

  return (
    <TrialIdProvider trialId={record.id}>
      <AnnotationsContext.Provider value={annotationsCap ? annotations : null}>
        <TrialChrome
          job={jobCap ? job : undefined}
          loupe={loupeBindings}
          trialId={record.id}
          record={record}
          instrument={instrument}
          isLastTrial={isLast}
          undoBindings={undoBindings}
          trialChrome={extraChrome}
          chrome={chrome}
          suppress={suppress}
          activeToolId={resolvedToolId}
          setActiveTool={setActiveTool}
        >
          {body}
          {annotationOverlays}
        </TrialChrome>
      </AnnotationsContext.Provider>
    </TrialIdProvider>
  );
}
