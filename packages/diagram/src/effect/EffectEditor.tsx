import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useLatest, type Paint } from '@weasel-js/core';
import type { CanConnect } from '../connect';
import { isBodyEnd } from '../connectTargets';
import { DiagramView, type DeleteReport, type DiagramViewApi, type DiagramViewProps, type NodeMove, type ReconnectChange } from '../DiagramView';
import { diagramScene, type DataEdge } from '../fromData';
import { EFFECT_MIN_SCALE } from './EffectChart';
import { addStage, addWire, canWire, ensureWireIds, moveStages, nextStageId, reconnectWire, removeStages, removeWires } from './edit';
import { editorScene, type EditorScene } from './editorMapping';
import { freeSpot } from './place';
import type { NodeGraphOptions } from './nodeGraph';
import { stageFromType, type EffectStageType } from './stageTypes';
import type { EffectDoc, EffectPipeline, EffectWire } from './types';

/** Props for `EffectEditor`. */
export interface EffectEditorProps {
  /** The pipeline and where its stages sit. The editor keeps none of it:
   *  every edit comes back through `onChange` and shows once `doc` follows. */
  doc: EffectDoc;
  /** Hears each edit as the doc it makes, and a name for it fit for an undo
   *  entry: 'Move', 'Connect', 'Delete', 'Reconnect' or 'Add stage'. */
  onChange: (next: EffectDoc, label: string) => void;
  /** A stage id, or null for none. */
  selected?: string | null;
  /** Hears each pick: a stage's id, or `null` for anything else, a wire included. */
  onSelect?: (stage: string | null) => void;
  /** `nodeGraph`'s options. Keep the object's identity steady between renders. */
  options?: NodeGraphOptions;
  /** CSS pixels. Omit both to fill the parent. */
  width?: number;
  height?: number;
  background?: Paint;
  className?: string;
}

/** What a `ref` on `EffectEditor` holds. */
export interface EffectEditorApi {
  /** Adds a stage of type `type` with its top-left at the world point under
   *  `client` when given. Without one it goes in the first free spot in view
   *  (`freeSpot`), and every stage layout placed is pinned where it shows, so
   *  nothing moves under it. Returns the new stage's id. */
  addStage(type: EffectStageType, client?: { x: number; y: number }): string;
}

type Ref = { stage: string; port: string };

/** The wire `a`–`b` describes, output first whichever end the drag began on,
 *  or `null` when `canWire` allows neither way. */
function orient(p: EffectPipeline, a: Ref, b: Ref): EffectWire | null {
  if (canWire(p, a, b)) return { from: a, to: b };
  if (canWire(p, b, a)) return { from: b, to: a };
  return null;
}

/** Whether a wire other than `except` already feeds input `to`. */
const fed = (p: EffectPipeline, to: Ref, except?: string) =>
  p.wires.some((w) => w.to.stage === to.stage && w.to.port === to.port && (except === undefined || w.id !== except));

/** A wire may join only an output to a free input of its type. */
function wireFor(p: EffectPipeline, a: Ref, b: Ref, except?: string): EffectWire | null {
  const wire = orient(p, a, b);
  return wire !== null && !fed(p, wire.to, except) ? wire : null;
}

/** The pipeline-mode editor: `nodeGraph`'s drawing of an effect pipeline,
 *  whose stages drag, whose ports wire output to input, and whose wires and
 *  stages reconnect and delete. Every edit is a doc handed to `onChange`.
 *  Text paints only in a registered font family, as with `EffectChart`. */
export const EffectEditor = forwardRef<EffectEditorApi, EffectEditorProps>(function EffectEditor(
  { doc, onChange, selected, onSelect, options, width, height, background, className },
  ref,
) {
  const built = useMemo(() => editorScene(doc, options), [doc, options]);
  const specs = useMemo(() => diagramScene(built.data, built.scene)
    // A group box picked would stay lit while `onSelect` says none; DiagramView makes edges pickable again.
    .map((s) => (s.pickable === false || built.stageOf(s.id as string) !== undefined ? s : { ...s, pickable: false })), [built]);
  const portOptions = useMemo((): DiagramViewProps['portOptions'] => ({
    shape: 'circle',
    sizePx: 8,
    showsPort: (port) => port.type !== undefined,
    fill: (port) => ({ paint: { color: built.color(port.type) } }),
  }), [built]);

  // The wire picked on the canvas: kept so a controlled `selected` of null
  // does not clear it, and so its own input does not count as fed while its end is dragged.
  const [edge, setEdge] = useState<string | null>(null);
  const pickedWire = edge === null ? undefined : built.wireOf(edge);
  const now = useLatest({ doc, built, specs, options, onChange, pickedWire });
  const view = useRef<DiagramViewApi | null>(null);
  const handlers = useMemo(() => editHandlers(() => now.current), [now]);

  useImperativeHandle(ref, () => ({
    addStage: (type, client) => {
      const { doc: d, specs: shown, options: opts, onChange: report } = now.current;
      const stage = stageFromType(type, nextStageId(d.pipeline, type.type));
      if (client && view.current) {
        report(addStage(ensureWireIds(d), stage, view.current.worldAt(client.x, client.y)), 'Add stage');
      } else {
        const boxes = stageBoxes(d, shown);
        const places = { ...Object.fromEntries([...boxes].map(([id, b]) => [id, { x: b.x, y: b.y }])), ...d.places };
        const alone: EffectDoc = { pipeline: { ...d.pipeline, stages: [stage], wires: [], groups: [] }, places: {} };
        const size = stageBoxes(alone, drawnSpecs(alone, opts)).get(stage.id) ?? { width: 0, height: 0 };
        const at = freeSpot([...boxes.values()], size, view.current?.visible() ?? null);
        report(addStage(ensureWireIds({ ...d, places }), stage, at), 'Add stage');
      }
      return stage.id;
    },
  }), [now]);

  const onSelectRef = useLatest(onSelect);
  const pick = useCallback((id: string | null) => {
    const { built: b } = now.current;
    const stage = id === null ? undefined : b.stageOf(id);
    setEdge(id !== null && stage === undefined && b.wireOf(id) !== undefined ? id : null);
    onSelectRef.current?.(stage ?? null);
  }, [now, onSelectRef]);

  const shown = selected === undefined ? undefined : selected ?? (pickedWire === undefined ? null : edge);
  return (
    <DiagramView
      ref={view}
      specs={specs}
      width={width}
      height={height}
      minScale={EFFECT_MIN_SCALE}
      anchor="start"
      ports="connect"
      portOptions={portOptions}
      canConnect={handlers.canConnect}
      onConnect={handlers.onConnect}
      onReconnect={handlers.onReconnect}
      onDelete={handlers.onDelete}
      onMove={handlers.onMove}
      onSelect={pick}
      {...(shown !== undefined ? { selected: shown } : {})}
      {...(background !== undefined ? { background } : {})}
      {...(className !== undefined ? { className } : {})}
    />
  );
});

type Box = { x: number; y: number; width: number; height: number };

/** The doc as `DiagramView` is handed it. */
function drawnSpecs(doc: EffectDoc, options: NodeGraphOptions | undefined) {
  const built = editorScene(doc, options);
  return diagramScene(built.data, built.scene);
}

/** Each stage's box as drawn, by stage id. */
function stageBoxes(doc: EffectDoc, specs: readonly { id?: unknown; pose?: unknown }[]): Map<string, Box> {
  const ids = new Set(doc.pipeline.stages.map((s) => s.id));
  return new Map(specs.filter((s) => ids.has(s.id as string)).map((s) => [s.id as string, s.pose as Box]));
}

interface Now {
  doc: EffectDoc;
  built: EditorScene;
  onChange: (next: EffectDoc, label: string) => void;
  pickedWire: string | undefined;
}

/** DiagramView's edit callbacks, each turning a report into an edit of the
 *  latest doc. Nothing is read back out of the scene. */
function editHandlers(now: () => Now) {
  const commit = (label: string, edit: (d: EffectDoc, b: EditorScene) => EffectDoc | null) => {
    const { doc, built, onChange } = now();
    const d = ensureWireIds(doc);
    const next = edit(d, built);
    if (next !== null) onChange(next, label);
  };
  const canConnect: CanConnect = (from, to) => {
    if (isBodyEnd(from) || isBodyEnd(to)) return false;
    const { doc, pickedWire } = now();
    return wireFor(doc.pipeline, { stage: from.nodeId, port: from.id }, { stage: to.nodeId, port: to.id }, pickedWire) !== null;
  };
  return {
    canConnect,
    onConnect: (e: DataEdge) => commit('Connect', (d) => {
      if (e.fromPort === undefined || e.toPort === undefined) return null;
      const wire = wireFor(d.pipeline, { stage: e.from, port: e.fromPort }, { stage: e.to, port: e.toPort });
      return wire === null ? null : addWire(d, wire);
    }),
    onReconnect: (c: ReconnectChange) => commit('Reconnect', (d, b) => {
      const id = b.wireOf(c.edge);
      const wire = d.pipeline.wires.find((w) => w.id === id);
      if (id === undefined || wire === undefined || c.port === undefined) return null;
      const moved = { stage: c.node, port: c.port };
      const [from, to] = c.end === 'from' ? [moved, wire.to] : [wire.from, moved];
      return canWire(d.pipeline, from, to) && !fed(d.pipeline, to, id) ? reconnectWire(d, id, c.end, moved) : null;
    }),
    onDelete: (r: DeleteReport) => commit('Delete', (d, b) => {
      const stages = r.nodes.flatMap((n) => b.stageOf(n) ?? []);
      const wires = r.edges.flatMap((e) => b.wireOf(e) ?? []);
      return stages.length === 0 && wires.length === 0 ? null : removeWires(removeStages(d, stages), wires);
    }),
    onMove: (moves: readonly NodeMove[]) => commit('Move', (d, b) => {
      const mine = moves.filter((m) => b.stageOf(m.id) !== undefined);
      return mine.length === 0 ? null : moveStages(d, mine);
    }),
  };
}
