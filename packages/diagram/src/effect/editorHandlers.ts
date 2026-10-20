/** `EffectEditor`'s edit callbacks: each turns what `DiagramView` reports
 *  into an edit of the latest doc. */
import type { CanConnect } from '../connect';
import { isBodyEnd } from '../connectTargets';
import type { DeleteReport, NodeMove, ReconnectChange, RouteChange } from '../DiagramView';
import type { DataEdge } from '../fromData';
import {
  addWire, canWire, ensureWireIds, moveStages, reconnectWire, removeStages, removeWires, setWireRoute,
} from './edit';
import type { EditorScene } from './editorMapping';
import type { EffectDoc, EffectPipeline, EffectWire } from './types';

type Ref = { stage: string; port: string };
export type Box = { x: number; y: number; width: number; height: number };
type Shown = readonly { id?: unknown; pose?: unknown }[];

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

/** The doc with every stage layout placed pinned where it shows, so a later
 *  layout pass moves nothing a person has seen. */
export function pinShown(doc: EffectDoc, specs: Shown): EffectDoc {
  const shown = Object.fromEntries([...stageBoxes(doc, specs)].map(([id, b]) => [id, { x: b.x, y: b.y }]));
  return { ...doc, places: { ...shown, ...doc.places } };
}

/** Each stage's box as drawn, by stage id. */
export function stageBoxes(doc: EffectDoc, specs: Shown): Map<string, Box> {
  const ids = new Set(doc.pipeline.stages.map((s) => s.id));
  return new Map(specs.filter((s) => ids.has(s.id as string)).map((s) => [s.id as string, s.pose as Box]));
}

/** What the handlers read, as of each report. */
export interface EditorNow {
  doc: EffectDoc;
  built: EditorScene;
  specs: Shown;
  onChange: (next: EffectDoc, label: string) => void;
}

/** DiagramView's edit callbacks, each turning a report into an edit of the
 *  latest doc. Nothing is read back out of the scene. */
export function editHandlers(now: () => EditorNow, unpick: () => void) {
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
    onEditRoute: (c: RouteChange) => commit('Edit route', (d, b) => {
      const id = b.wireOf(c.edge);
      return id === undefined ? null : setWireRoute(d, id, c.waypoints);
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
