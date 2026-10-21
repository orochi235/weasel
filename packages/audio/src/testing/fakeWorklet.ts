import type { FromProcessor, ToProcessor } from '../worklet/protocol';
import type { FakeAudioContext } from './fakeAudioContext';

/** An `AudioWorkletNode` that records what is posted to it. */
export interface FakeWorkletNode {
  name: string;
  posted: ToProcessor[];
  connectedTo: unknown[];
  disconnected: boolean;
  port: { postMessage(message: ToProcessor): void; onmessage: ((e: { data: FromProcessor }) => void) | null };
  connect(target: unknown): void;
  disconnect(): void;
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

  class FakeAudioWorkletNode implements FakeWorkletNode {
    posted: ToProcessor[] = [];
    connectedTo: unknown[] = [];
    disconnected = false;
    port: FakeWorkletNode['port'];
    constructor(_ctx: unknown, readonly name: string) {
      this.port = { postMessage: (m) => { this.posted.push(m); }, onmessage: null };
      nodes.push(this);
    }
    connect(target: unknown) { this.connectedTo.push(target); }
    disconnect() { this.disconnected = true; }
    _ended(id: number) { this.port.onmessage?.({ data: { kind: 'ended', id } }); }
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
