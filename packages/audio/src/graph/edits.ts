import type { Timers } from '../audioTime';
import { blocked, drop, findLive, logical, reaches, touches, type Edge } from './edges';
import { createFader } from './fader';
import { replaceDef } from './replace';
import type { GraphNodeDef, GraphTarget } from './types';
import { closesCycle, duplicateNode, noNode, noParam, noPort, owns } from './errors';
import type { GraphView } from './validate';
import { createWrapper, releaseWrapper, type NodeWrapper } from './wrapper';

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

/** The far end of `to`, checked: its wrapper (null for the output) and port. */
function target(live: (id: string) => NodeWrapper, to: GraphTarget): [NodeWrapper | null, string] {
  if ('output' in to) return [null, ''];
  const w = live(to.node);
  if (!owns(w.ins, to.port)) throw noPort(to.node, to.port);
  return [w, to.port];
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
    if (!w) throw noNode(id);
    return w;
  };

  const wire = (e: Edge): void => {
    e.state = 'open';
    e.fader = createFader(ctx, timers, e.from.out, e.to ? e.to.ins[e.port] : output);
    e.fader.open(fade());
  };

  /** Wire what is no longer blocked, release what nothing touches, then wake `settled`. */
  const sweep = (): void => {
    for (const e of edges) if (e.state === 'deferred' && !blocked(edges, e)) wire(e);
    for (const w of [...leaving]) {
      if (edges.some((e) => touches(e, w))) continue;
      leaving.delete(w);
      releaseWrapper(w, ctx.currentTime);
    }
    deps.onSettle();
  };

  /** Fade an open edge out; a deferred one was never wired and just goes. */
  const close = (e: Edge): void => {
    if (e.state === 'closing') return;
    if (e.state === 'deferred') {
      drop(edges, e);
      return;
    }
    e.state = 'closing';
    e.fader!.close(fade(), () => {
      drop(edges, e);
      sweep();
    });
  };

  return {
    live,
    has: (id: string) => nodes.has(id),
    ids: () => [...nodes.keys()],
    liveNodes: () => [...nodes.values()],
    /** Live and leaving: every wrapper whose def has not been released. */
    allNodes: () => [...nodes.values(), ...leaving],
    /** The live nodes and the edges a caller can see, by id, for `validatePatches`. */
    view: (): GraphView => ({
      nodes: new Map([...nodes].map(([id, w]) => [id, { ports: new Set(Object.keys(w.ins)), params: w.def.params }])),
      edges: edges.filter(logical).map((e) => ({ from: e.from.id, to: e.to?.id ?? null, port: e.port })),
    }),
    /** An edge is fading out or waiting to be wired, or a replaced def is fading out. */
    busy: () =>
      edges.some((e) => e.state !== 'open') ||
      [...nodes.values(), ...leaving].some((w) => w.outgoing.size > 0),
    add(id: string, def: GraphNodeDef): void {
      if (nodes.has(id)) throw duplicateNode(id);
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
    /** Crossfade `id` into `def`; edges into a port `def` lacks close with it. */
    replace(id: string, def: GraphNodeDef, playing: boolean): void {
      const w = live(id);
      replaceDef(ctx, timers, w, def, fade(), playing, {
        closePort: (port) => {
          for (const e of edges.filter((x) => x.to === w && x.port === port)) close(e);
        },
        onSettle: deps.onSettle,
      });
      deps.onSettle();
    },
    connect(from: string, to: GraphTarget): void {
      const w = live(from);
      const [tw, port] = target(live, to);
      if (findLive(edges, w, tw, port)) return;
      if (tw && reaches(edges, tw, w, logical)) {
        throw closesCycle(from, tw.id);
      }
      const e: Edge = { from: w, to: tw, port, state: 'deferred', fader: null };
      edges.push(e);
      if (!blocked(edges, e)) wire(e);
    },
    disconnect(from: string, to: GraphTarget): void {
      const w = nodes.get(from);
      const tw = 'output' in to ? null : nodes.get(to.node);
      if (!w || tw === undefined) return;
      const e = findLive(edges, w, tw, 'output' in to ? '' : to.port);
      if (!e) return;
      close(e);
      deps.onSettle();
    },
    set(id: string, param: string, value: number, rampMs?: number): void {
      const w = live(id);
      if (!owns(w.def.params, param)) throw noParam(id, param);
      w.def.params[param](value, rampMs ?? fade());
    },
    /** Cut every edge, canceling its close, then release every def. */
    dispose(): void {
      for (const e of edges.splice(0)) e.fader?.cut();
      const all = [...nodes.values(), ...leaving];
      nodes.clear();
      leaving.clear();
      for (const w of all) releaseWrapper(w, ctx.currentTime);
    },
  };
}
