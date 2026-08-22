import { describe, expect, it } from 'vitest';
import { createBusGraph } from './buses';
import { createFakeAudioContext, type FakeParam } from './testing/fakeAudioContext';

describe('createBusGraph', () => {
  it('routes every named bus to master and master to the destination', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx', 'music']);
    const wiredTo = (n: AudioNode) => (n as never as { connectedTo: unknown[] }).connectedTo;
    expect(wiredTo(graph.node('sfx'))).toContain(graph.master);
    expect(wiredTo(graph.node('music'))).toContain(graph.master);
    expect(wiredTo(graph.master)).toContain(ctx.destination);
  });

  it('sets a bus gain', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    graph.bus('sfx').setGain(0.25);
    expect((graph.node('sfx') as never as { gain: { value: number } }).gain.value).toBe(0.25);
  });

  it('mutes a bus to zero and restores the prior gain on unmute', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    const gain = () => (graph.node('sfx') as never as { gain: { value: number } }).gain.value;
    graph.bus('sfx').setGain(0.4);
    graph.bus('sfx').mute(true);
    expect(gain()).toBe(0);
    graph.bus('sfx').mute(false);
    expect(gain()).toBe(0.4);
  });

  it('soloing one bus silences the others', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx', 'music']);
    const gain = (n: string) => (graph.node(n) as never as { gain: { value: number } }).gain.value;
    graph.bus('sfx').solo(true);
    expect(gain('sfx')).toBe(1);
    expect(gain('music')).toBe(0);
  });

  it('clearing the last solo restores every bus', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx', 'music']);
    const gain = (n: string) => (graph.node(n) as never as { gain: { value: number } }).gain.value;
    graph.bus('sfx').solo(true);
    graph.bus('sfx').solo(false);
    expect(gain('music')).toBe(1);
  });

  it('keeps a muted bus silent when it is also soloed', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    const gain = () => (graph.node('sfx') as never as { gain: { value: number } }).gain.value;
    graph.bus('sfx').mute(true);
    graph.bus('sfx').solo(true);
    expect(gain()).toBe(0);
  });

  it('ramps a bus gain instead of jumping to it', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    const gain = (graph.node('sfx') as never as { gain: FakeParam }).gain;
    ctx._advance(1000);
    graph.bus('sfx').setGain(0.25, 200);
    expect(gain.ramps).toEqual([{ value: 0.25, at: 1.2 }]);
    // The recomputation that follows must not write the target underneath it.
    expect(gain.value).toBe(1);
  });

  it('anchors every ramp at the current value and time', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    const gain = (graph.node('sfx') as never as { gain: FakeParam }).gain;
    graph.bus('sfx').setGain(0.25, 200);
    ctx._advance(500);
    graph.bus('sfx').setGain(1, 200);
    expect(gain.cancels).toEqual([0, 0.5]);
    expect(gain.holds.map((h) => h.at)).toEqual([0, 0.5]);
  });

  it('ramps only the bus that was set, not the ones a solo recomputes', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx', 'music']);
    const music = (graph.node('music') as never as { gain: FakeParam }).gain;
    graph.bus('sfx').setGain(0.5, 200);
    expect(music.ramps).toEqual([]);
  });

  it('writes mute through the scheduled path, not behind it', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    const gain = (graph.node('sfx') as never as { gain: FakeParam }).gain;
    graph.bus('sfx').mute(true);
    expect(gain.holds).toEqual([{ value: 0, at: 0 }]);
  });

  it('throws for an unknown bus name', () => {
    const ctx = createFakeAudioContext();
    const graph = createBusGraph(ctx as never, ['sfx']);
    expect(() => graph.bus('nope')).toThrow(/nope/);
  });
});
