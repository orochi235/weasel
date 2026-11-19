import type { FromProcessor, ToProcessor } from '../worklet/protocol';
import type { FakeAudioContext } from './fakeAudioContext';
import { node, type FakeNode } from './fakeNode';

/** An `AudioWorkletNode` that records what is posted to it. Its edges are a
 *  `FakeNode`'s, so a graph walk and a disconnect treat it as any other node. */
export interface FakeWorkletNode extends FakeNode {
  name: string;
  posted: ToProcessor[];
  port: { postMessage(message: ToProcessor): void; onmessage: ((e: { data: FromProcessor }) => void) | null };
  /** Test hook: the processor reports voice `id` ended. */
  _ended(id: number): void;
}

export interface FakeWorklet {
  nodes: FakeWorkletNode[];
  /** Test hook: settle `addModule`, or fail it. */
  _load(error?: Error): void;
  restore(): void;
}

/** Give a fake context an `audioWorklet` whose `addModule` waits on `_load`,
 *  and the global scope an `AudioWorkletNode` that records its messages. */
export function installFakeWorklet(ctx: FakeAudioContext): FakeWorklet {
  const nodes: FakeWorkletNode[] = [];
  let settle: ((error?: Error) => void) | null = null;
  const pending = new Promise<void>((resolve, reject) => {
    settle = (error) => (error ? reject(error) : resolve());
  });
  (ctx as unknown as { audioWorklet: unknown }).audioWorklet = { addModule: () => pending };

  class FakeAudioWorkletNode {
    // A constructor returning an object makes `new` yield it, so the node a
    // target's `connectedFrom` holds is the very one the code under test has.
    constructor(_ctx: unknown, name: string) {
      const n: FakeWorkletNode = node('worklet', {
        name,
        posted: [] as ToProcessor[],
        port: {
          postMessage: (m: ToProcessor) => { n.posted.push(m); },
          onmessage: null as FakeWorkletNode['port']['onmessage'],
        },
        _ended(id: number) { n.port.onmessage?.({ data: { kind: 'ended', id } }); },
      });
      nodes.push(n);
      return n;
    }
  }

  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { node: g.AudioWorkletNode, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  g.AudioWorkletNode = FakeAudioWorkletNode;
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};

  return {
    nodes,
    _load: (error) => settle?.(error),
    restore() {
      g.AudioWorkletNode = saved.node;
      URL.createObjectURL = saved.create;
      URL.revokeObjectURL = saved.revoke;
    },
  };
}
