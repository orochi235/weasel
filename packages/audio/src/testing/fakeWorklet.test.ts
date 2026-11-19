import { afterEach, describe, expect, it } from 'vitest';
import { createFakeAudioContext } from './fakeAudioContext';
import { allPaths } from './graphWalk';
import { installFakeWorklet, type FakeWorklet } from './fakeWorklet';

let worklet: FakeWorklet | null = null;
afterEach(() => { worklet?.restore(); worklet = null; });

const workletNode = (ctx: unknown) =>
  new (globalThis as unknown as { AudioWorkletNode: new (c: unknown, n: string) => unknown })
    .AudioWorkletNode(ctx, 'voice');

describe('installFakeWorklet', () => {
  it('wires its nodes both ways, chains connect, and cuts them on disconnect', () => {
    const ctx = createFakeAudioContext();
    worklet = installFakeWorklet(ctx);
    workletNode(ctx);
    const n = worklet.nodes[0];
    const gain = ctx.createGain();
    expect(n.connect(gain)).toBe(gain);
    gain.connect(ctx.destination);
    expect(allPaths(n as never, ctx.destination)).toHaveLength(1);
    expect(gain.connectedFrom).toContain(n);
    n.disconnect();
    expect(n.disconnected).toBe(true);
    expect(allPaths(n as never, ctx.destination)).toHaveLength(0);
    expect(gain.connectedFrom).not.toContain(n);
  });
});
