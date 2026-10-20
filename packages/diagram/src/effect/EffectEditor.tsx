import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useLatest, type Paint } from '@weasel-js/core';
import type { CanConnect } from '../connect';
import { isBodyEnd } from '../connectTargets';
import { DiagramView, type DeleteReport, type DiagramViewApi, type DiagramViewProps, type NodeMove, type ReconnectChange } from '../DiagramView';
import { diagramScene, type DataEdge } from '../fromData';
import { EFFECT_MIN_SCALE } from './EffectChart';
import { addStage, addWire, canWire, ensureWireIds, moveStages, nextStageId, reconnectWire, removeStages, removeWires } from './edit';
import { editorScene, type EditorLookOptions, type EditorScene } from './editorMapping';
import { editorReorders } from './editorReorder';
import { freeSpot } from './place';
import type { LanesOptions } from './lanes';
import type { NodeGraphOptions } from './nodeGraph';
import { stageFromType, type EffectStageType } from './stageTypes';
import type { EffectDoc, EffectPipeline, EffectWire } from './types';

/** Which look `EffectEditor` draws in, and that look's options. Keep the
 *  options object's identity steady between renders. */
export type EffectEditorLookProps =
  | { look?: 'nodeGraph'; options?: NodeGraphOptions }
  | { look: 'rack'; options?: EditorLookOptions['rack'] }
  | { look: 'lanes'; options?: LanesOptions };

/** Props for `EffectEditor`. */
export type EffectEditorProps = EffectEditorBaseProps & EffectEditorLookProps;

/** `EffectEditor`'s props apart from its look. */
export interface EffectEditorBaseProps {
  /** The pipeline and where its stages sit. The editor keeps none of it:
   *  every edit comes back through `onChange` and shows once `doc` follows. */
  doc: EffectDoc;
  /** Hears each edit as the doc it makes, and a name for it fit for an undo
   *  entry: 'Move', 'Connect', 'Delete', 'Reconnect', 'Add stage', 'Reorder'
   *  or 'Reorder lanes'. */
  onChange: (next: EffectDoc, label: string) => void;
  /** A stage id, or null for none. */
  selected?: string | null;
  /** Hears each pick: a stage's id, or `null` for anything else, a wire included. */
  onSelect?: (stage: string | null) => void;
  /** CSS pixels. Omit both to fill the parent. */
  width?: number;
  height?: number;
  background?: Paint;
  className?: string;
}

/** What a `ref` on `EffectEditor` holds. */
export interface EffectEditorApi {
  /** Adds a stage of type `type`. Under `nodeGraph` its top-left goes at the
   *  world point under `client` when given, or in the first free spot in view
   *  (`freeSpot`), and like a drag it pins every stage layout placed where it
   *  shows, so nothing moves under it; the other looks place it themselves.
   *  Returns the new stage's id. */
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

/** The pipeline-mode editor: a look's drawing of an effect pipeline, whose
 *  ports wire output to input, and whose wires and stages reconnect and
 *  delete. Under `nodeGraph` stages drag freely; under `rack` and `lanes` a
 *  stage on the main line drags along it to another place, rewiring the
 *  pipeline, and under `lanes` a lane drags by its header. Every edit is a
 *  doc handed to `onChange`. Text paints only in a registered font family,
 *  as with `EffectChart`. */
export const EffectEditor = forwardRef<EffectEditorApi, EffectEditorProps>(function EffectEditor(
  { doc, onChange, selected, onSelect, look = 'nodeGraph', options, width, height, background, className },
  ref,
) {
  const built = useMemo(() => editorScene(doc, look, options), [doc, look, options]);
  const specs = useMemo(() => diagramScene(built.data, built.scene)
    // A group box picked would stay lit while `onSelect` says none; DiagramView makes edges pickable again.
    .map((s) => (s.pickable === false || built.stageOf(s.id as string) !== undefined ? s : { ...s, pickable: false })), [built]);
  const portOptions = useMemo((): DiagramViewProps['portOptions'] => ({
    shape: 'circle',
    sizePx: 8,
    showsPort: (port) => port.type !== undefined,
    fill: (port) => ({ paint: { color: built.color(port.type) } }),
  }), [built]);

  // The wire picked on the canvas, kept so a controlled `selected` of null does not clear it.
  const [edge, setEdge] = useState<string | null>(null);
  const pickedWire = edge === null ? undefined : built.wireOf(edge);
  const now = useLatest({ doc, built, specs, look, options, onChange });
  const view = useRef<DiagramViewApi | null>(null);
  const handlers = useMemo(() => editHandlers(() => now.current, () => setEdge(null)), [now]);
  const reorders = useMemo(() => editorReorders(() => {
    const { doc: d, built: b, specs: shown, onChange: report } = now.current;
    const boxes = new Map(shown.map((s) => [s.id as string, s.pose as Box]));
    return { doc: d, order: b.order, laneOrder: b.laneOrder, boxOf: (id) => boxes.get(id), onChange: report };
  }), [now]);

  useImperativeHandle(ref, () => ({
    addStage: (type, client) => {
      const { doc: d, specs: shown, look: l, options: opts, onChange: report } = now.current;
      const stage = stageFromType(type, nextStageId(d.pipeline, type.type));
      if (l !== 'nodeGraph') {
        report(addStage(ensureWireIds(d), stage), 'Add stage');
        return stage.id;
      }
      const pinned = ensureWireIds(pinShown(d, shown));
      if (client && view.current) {
        report(addStage(pinned, stage, view.current.worldAt(client.x, client.y)), 'Add stage');
      } else {
        const boxes = stageBoxes(d, shown);
        const alone: EffectDoc = { pipeline: { ...d.pipeline, stages: [stage], wires: [], groups: [] }, places: {} };
        const size = stageBoxes(alone, drawnSpecs(alone, opts as NodeGraphOptions | undefined)).get(stage.id) ?? { width: 0, height: 0 };
        const at = freeSpot([...boxes.values()], size, view.current?.visible() ?? null);
        report(addStage(pinned, stage, at), 'Add stage');
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
      {...(look === 'nodeGraph' ? { onMove: handlers.onMove } : { ambient: reorders })}
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
  const built = editorScene(doc, 'nodeGraph', options);
  return diagramScene(built.data, built.scene);
}

/** The doc with every stage layout placed pinned where it shows, so a later
 *  layout pass moves nothing a person has seen. */
function pinShown(doc: EffectDoc, specs: readonly { id?: unknown; pose?: unknown }[]): EffectDoc {
  const shown = Object.fromEntries([...stageBoxes(doc, specs)].map(([id, b]) => [id, { x: b.x, y: b.y }]));
  return { ...doc, places: { ...shown, ...doc.places } };
}

/** Each stage's box as drawn, by stage id. */
function stageBoxes(doc: EffectDoc, specs: readonly { id?: unknown; pose?: unknown }[]): Map<string, Box> {
  const ids = new Set(doc.pipeline.stages.map((s) => s.id));
  return new Map(specs.filter((s) => ids.has(s.id as string)).map((s) => [s.id as string, s.pose as Box]));
}

interface Now {
  doc: EffectDoc;
  built: EditorScene;
  specs: readonly { id?: unknown; pose?: unknown }[];
  onChange: (next: EffectDoc, label: string) => void;
}

/** DiagramView's edit callbacks, each turning a report into an edit of the
 *  latest doc. Nothing is read back out of the scene. */
function editHandlers(now: () => Now, unpick: () => void) {
  const commit = (label: string, edit: (d: EffectDoc, b: EditorScene) => EffectDoc | null) => {
    const { doc, built, onChange } = now();
    const d = ensureWireIds(doc);
    const next = edit(d, built);
    if (next !== null) onChange(next, label);
  };
  // A wire whose end is being moved does not count as feeding its own input.
  const canConnect: CanConnect = (from, to, moving) => {
    if (isBodyEnd(from) || isBodyEnd(to)) return false;
    const { doc, built } = now();
    const except = moving === undefined ? undefined : built.wireOf(moving.edge);
    return wireFor(doc.pipeline, { stage: from.nodeId, port: from.id }, { stage: to.nodeId, port: to.id }, except) !== null;
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
      // A freed wire id is minted again for the next wire, which would come back picked.
      unpick();
      const stages = r.nodes.flatMap((n) => b.stageOf(n) ?? []);
      const wires = r.edges.flatMap((e) => b.wireOf(e) ?? []);
      return stages.length === 0 && wires.length === 0 ? null : removeWires(removeStages(d, stages), wires);
    }),
    onMove: (moves: readonly NodeMove[]) => commit('Move', (d, b) => {
      const mine = moves.filter((m) => b.stageOf(m.id) !== undefined);
      return mine.length === 0 ? null : moveStages(pinShown(d, now().specs), mine);
    }),
  };
}
