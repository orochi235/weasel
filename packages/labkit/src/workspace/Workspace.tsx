import { type ReactNode, useContext, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand/react';
import { CanvasStack } from '../canvas/CanvasStack';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import type {
  Instrument,
  LayerDescriptor,
  RenderContext,
  ViewTransform,
} from '../instrument/types';
import { useLabContext } from '../lab/LabContext';
import { LayerList } from '../layers/LayerList';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import type { WorkspaceRecord } from '../state/types';
import { createEventBus, type EventBus } from '../undo/eventBus';
import { pushSnapshot, redo as undoRedo, undo as undoUndo } from '../undo/undoStack';
import type { UndoBindings } from './WorkspaceChrome';
import { WorkspaceChrome } from './WorkspaceChrome';

export interface WorkspaceProps {
  id: string;
}

export function Workspace({ id }: WorkspaceProps) {
  const lab = useLabContext();
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] <Workspace> requires <LabStoreProvider>');
  const record = useStore(storeCtx.store, (s) => s.workspaces.find((w) => w.id === id));
  if (!record) {
    return <div className="lk-workspace lk-workspace--unknown">Workspace not found: {id}</div>;
  }
  const instrument = lab.instruments.find((i) => i.name === record.instrumentName);
  if (!instrument) {
    return (
      <div className="lk-workspace lk-workspace--unknown">
        Unknown instrument: {record.instrumentName}
      </div>
    );
  }
  return (
    <WorkspaceRuntime
      record={record}
      instrument={instrument}
      store={storeCtx.store}
      isLast={lab.workspaces.length <= 1}
    />
  );
}

interface WorkspaceRuntimeProps {
  record: WorkspaceRecord;
  instrument: Instrument;
  store: LabStore;
  isLast: boolean;
}

function WorkspaceRuntime({ record, instrument, store, isLast }: WorkspaceRuntimeProps) {
  const updateWorkspaceState = useStore(store, (s) => s.updateWorkspaceState);
  const updateWorkspaceConfig = useStore(store, (s) => s.updateWorkspaceConfig);
  const updateWorkspaceView = useStore(store, (s) => s.updateWorkspaceView);
  const updateWorkspaceUndoStack = useStore(store, (s) => s.updateWorkspaceUndoStack);

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
    const current = store.getState().workspaces.find((w) => w.id === record.id);
    if (!current) return;
    const snap = structuredClone(current.state);
    updateWorkspaceUndoStack(record.id, (prev) => pushSnapshot(prev, snap, maxDepth));
  };

  const setView = (v: ViewTransform): void => updateWorkspaceView(record.id, v);

  const renderCtx: RenderContext<unknown, unknown> = {
    state: record.state,
    config: record.config,
    setState: (next) => {
      snapshotIfNeeded('state.change');
      updateWorkspaceState(record.id, next);
      bus.emit('state.change');
    },
    setConfig: (key, value) => {
      const evt = `config.change:${String(key)}`;
      snapshotIfNeeded('config.change');
      snapshotIfNeeded(evt);
      updateWorkspaceConfig(record.id, key as never, value as never);
      bus.emit('config.change');
      bus.emit(evt);
    },
    workspace: {
      id: record.id,
      zoom: record.view.zoom,
      setZoom: (z) => updateWorkspaceView(record.id, { ...record.view, zoom: z }),
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
          const result = undoUndo(record.undoStack);
          if (!result) return;
          updateWorkspaceState(record.id, result.snapshot as never);
          updateWorkspaceUndoStack(record.id, result.stack);
        },
        redo: () => {
          const result = undoRedo(record.undoStack);
          if (!result) return;
          updateWorkspaceState(record.id, result.snapshot as never);
          updateWorkspaceUndoStack(record.id, result.stack);
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
      render: (ctx, view) =>
        layer.draw(ctx, { state: record.state, config: record.config, zoom: view.zoom }),
    }));
  }, [instrument.canvas, record.state, record.config, layerVisibility, layerOrder]);

  const layerDescriptors: LayerDescriptor[] = useMemo(() => {
    if (!instrument.layers) return [];
    return instrument.layers.ids.map((lid) => ({ id: lid, label: lid }));
  }, [instrument.layers]);

  let body: ReactNode;
  if (instrument.canvas) {
    body = <CanvasStack layers={canvasLayers} view={record.view} onViewChange={setView} />;
  } else {
    body = instrument.render(renderCtx);
  }

  const sidebarExtras =
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
    <WorkspaceChrome
      workspaceId={record.id}
      record={record}
      instrument={instrument}
      isLastWorkspace={isLast}
      undoBindings={undoBindings}
      sidebarExtras={sidebarExtras}
    >
      {body}
    </WorkspaceChrome>
  );
}
