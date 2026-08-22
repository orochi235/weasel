import { type ReactNode, useContext, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand/react';
import { CanvasStack } from '../canvas/CanvasStack';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { DragOverlay, useDragDrop } from '../dragdrop/DragDropRuntime';
import { Palette } from '../dragdrop/Palette';
import type {
  Instrument,
  LayerDescriptor,
  PaletteItem,
  RenderContext,
  ViewTransform,
} from '../instrument/types';
import { useLabContext } from '../lab/LabContext';
import { LayerList } from '../layers/LayerList';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { createEventBus, type EventBus } from '../undo/eventBus';
import { pushSnapshot, redo as undoRedo, undo as undoUndo } from '../undo/undoStack';
import type { UndoBindings } from './TrialChrome';
import { TrialChrome } from './TrialChrome';

/** Props for `<Trial>`. */
export interface TrialProps {
  id: string;
}

/** Renders one trial from the lab store: looks up its record and
 *  instrument, and mounts the instrument inside the trial chrome. */
export function Trial({ id }: TrialProps) {
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
    />
  );
}

interface TrialRuntimeProps {
  record: TrialRecord;
  instrument: Instrument;
  store: LabStore;
  isLast: boolean;
}

function TrialRuntime({ record, instrument, store, isLast }: TrialRuntimeProps) {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const updateTrialState = useStore(store, (s) => s.updateTrialState);
  const updateTrialConfig = useStore(store, (s) => s.updateTrialConfig);
  const updateTrialView = useStore(store, (s) => s.updateTrialView);
  const updateTrialUndoStack = useStore(store, (s) => s.updateTrialUndoStack);

  const busRef = useRef<EventBus | null>(null);
  if (busRef.current === null) busRef.current = createEventBus();
  const bus = busRef.current;

  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [layerOrder, setLayerOrder] = useState<string[] | null>(null);

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

  const setView = (v: ViewTransform): void => updateTrialView(record.id, v);

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
      zoom: record.view.zoom,
      setZoom: (z) => updateTrialView(record.id, { ...record.view, zoom: z }),
    },
    emit: (event) => {
      snapshotIfNeeded(event);
      bus.emit(event);
    },
  };

  const undoBindings: UndoBindings | undefined = undoCap
    ? {
        canUndo: record.undoStack.past.length > 0,
        canRedo: record.undoStack.future.length > 0,
        undo: () => {
          const result = undoUndo(record.undoStack, structuredClone(record.state));
          if (!result) return;
          updateTrialState(record.id, result.snapshot as never);
          updateTrialUndoStack(record.id, result.stack);
        },
        redo: () => {
          const result = undoRedo(record.undoStack, structuredClone(record.state));
          if (!result) return;
          updateTrialState(record.id, result.snapshot as never);
          updateTrialUndoStack(record.id, result.stack);
        },
      }
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
      render: (ctx, view) => {
        // Camera applied here, so a layer draws in world coordinates. `zoom`
        // stays in the args for line widths, which must not scale with it.
        ctx.translate(view.pan.x, view.pan.y);
        ctx.scale(view.zoom, view.zoom);
        layer.draw(ctx, { state: record.state, config: record.config, zoom: view.zoom });
      },
    }));
  }, [instrument.canvas, record.state, record.config, layerVisibility, layerOrder]);

  const layerDescriptors: LayerDescriptor[] = useMemo(() => {
    if (!instrument.layers) return [];
    return instrument.layers.ids.map((lid) => ({ id: lid, label: lid }));
  }, [instrument.layers]);

  const dragDropResult = useDragDrop({
    capability: instrument.dragDrop ?? { palette: [], onDrop: (_p, _i, s) => s },
    canvasContainerRef,
    view: record.view,
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

  let body: ReactNode;
  if (instrument.canvas) {
    body = (
      <div
        ref={canvasContainerRef}
        className="lk-trial__canvas-host"
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        <CanvasStack layers={layersWithFeedback} view={record.view} onViewChange={setView}>
          {instrument.render(renderCtx)}
        </CanvasStack>
        <DragOverlay drag={dragDropResult.drag} />
      </div>
    );
  } else {
    body = instrument.render(renderCtx);
  }

  const paletteNode =
    paletteItems.length > 0 ? (
      <Palette items={paletteItems} onDragStart={dragDropResult.startDrag} />
    ) : null;

  const layerListNode =
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
    ) : null;

  return (
    <TrialChrome
      trialId={record.id}
      record={record}
      instrument={instrument}
      isLastTrial={isLast}
      undoBindings={undoBindings}
      sidebarExtras={
        <>
          {paletteNode}
          {layerListNode}
        </>
      }
    >
      {body}
    </TrialChrome>
  );
}
