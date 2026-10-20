import type { Timers } from '../audioTime';
import { findLive, reaches, touches, type Edge } from './edges';
import { createFader } from './fader';
import type { GraphNodeDef, GraphTarget } from './types';
import { createWrapper, releaseWrapper, type NodeWrapper } from './wrapper';

export const graphError = (msg: string): Error => new Error(`@weasel-js/audio: ${msg}`);
const owns = (rec: object, key: string): boolean => Object.prototype.hasOwnProperty.call(rec, key);

export interface EditsDeps {
  ctx: BaseAudioContext;
  timers: Timers;
  /** The fade for an edit made now: 0 unless the context is running. */
  fade(): number;
  /** Where an edge to `{ output: true }` lands. */
  output: AudioNode;
  /** Called when a node is added, to start it if the graph is playing. */
  onAdd(w: NodeWrapper): void;
  /** Called after every close finishes, to wake `settled`. */
  onSettle(): void;
}

/** The graph's nodes and edges: every structural edit, and the bookkeeping that
 *  lets a removed node finish fading out after its id is free again. */
export function createEdits(deps: EditsDeps) {
  const { ctx, timers, fade, output } = deps;
  const nodes = new Map<string, NodeWrapper>();
  /** Out of `nodes` at once, released once no edge touches them. */
  const leaving = new Set<NodeWrapper>();
  const edges: Edge[] = [];

  const live = (id: string): NodeWrapper => {
    const w = nodes.get(id);
    if (!w) throw graphError(`no node "${id}"`);
    return w;
  };

  const sweep = (): void => {
    for (const w of [...leaving]) {
      if (edges.some((e) => touches(e, w))) continue;
      leaving.delete(w);
      releaseWrapper(w, ctx.currentTime);
    }
    deps.onSettle();
  };

  const close = (e: Edge): void => {
    if (e.closing) return;
    e.closing = true;
    e.fader.close(fade(), () => {
      edges.splice(edges.indexOf(e), 1);
      sweep();
    });
  };

  const target = (to: GraphTarget): [NodeWrapper | null, string] => {
    if ('output' in to) return [null, ''];
    const w = live(to.node);
    if (!owns(w.ins, to.port)) throw graphError(`node "${to.node}" has no input port "${to.port}"`);
    return [w, to.port];
  };

  return {
    live,
    has: (id: string) => nodes.has(id),
    ids: () => [...nodes.keys()],
    liveNodes: () => [...nodes.values()],
    /** Live and leaving: every wrapper whose def has not been released. */
    allNodes: () => [...nodes.values(), ...leaving],
    closing: () => edges.some((e) => e.closing),
    add(id: string, def: GraphNodeDef): void {
      if (nodes.has(id)) throw graphError(`a node "${id}" already exists`);
      const w = createWrapper(ctx, timers, id, def);
      nodes.set(id, w);
      deps.onAdd(w);
    },
    remove(id: string): void {
      const w = nodes.get(id);
      if (!w) return;
      nodes.delete(id);
      leaving.add(w);
      for (const e of edges.filter((x) => touches(x, w))) close(e);
      sweep();
    },
    connect(from: string, to: GraphTarget): void {
      const w = live(from);
      const [tw, port] = target(to);
      if (findLive(edges, w, tw, port)) return;
      if (tw && reaches(edges, tw, w)) {
        throw graphError(`connecting "${from}" to "${tw.id}" would close a cycle`);
      }
      const fader = createFader(ctx, timers, w.out, tw ? tw.ins[port] : output);
      edges.push({ from: w, to: tw, port, fader, closing: false });
      fader.open(fade());
    },
    disconnect(from: string, to: GraphTarget): void {
      const w = nodes.get(from);
      const tw = 'output' in to ? null : nodes.get(to.node);
      if (!w || tw === undefined) return;
      const e = findLive(edges, w, tw, 'output' in to ? '' : to.port);
      if (e) close(e);
    },
    set(id: string, param: string, value: number, rampMs?: number): void {
      const w = live(id);
      if (!owns(w.def.params, param)) throw graphError(`node "${id}" has no param "${param}"`);
      w.def.params[param](value, rampMs ?? fade());
    },
    /** Cut every edge, canceling its close, then release every def. */
    dispose(): void {
      for (const e of edges.splice(0)) e.fader.cut();
      const all = [...nodes.values(), ...leaving];
      nodes.clear();
      leaving.clear();
      for (const w of all) releaseWrapper(w, ctx.currentTime);
    },
  };
}
