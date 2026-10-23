import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { RectPose, Vec2 } from '@weasel-js/core';
import type { Graph } from './graph';
import { layered } from './layered';
import type { LayoutPlan, LayoutPlanner } from './layout';
import { useLiveLayout } from './live';
import { box, graphOf, makeClock, scene } from './liveFixture';
import { sceneParticipants } from './portLayer';

/** A plan answered later, when the test says so. */
function deferred() {
  const asked: Graph[] = [];
  const answers: ((plan: LayoutPlan) => void)[] = [];
  const planner: LayoutPlanner = {
    plan: (graph) => {
      asked.push(graph);
      return new Promise<LayoutPlan>((resolve) => { answers.push(resolve); });
    },
  };
  /** Answer request `k` with what `layered` would have planned for its graph. */
  const answer = async (k = answers.length - 1) => {
    await act(async () => { answers[k]!(layered.plan!(asked[k]!)); });
  };
  return { planner, asked, answer };
}

function live(planner: LayoutPlanner, onError?: (error: unknown) => void) {
  const s = scene();
  const clock = makeClock();
  const { result } = renderHook(() => useLiveLayout<RectPose>({
    ...(onError ? { onError } : {}),
    scene: s.scene,
    source: sceneParticipants<RectPose>(s.scene as never),
    algorithm: planner,
    frames: 4,
    requestFrame: clock.requestFrame,
    cancelFrame: clock.cancelFrame,
  }));
  return { ...s, clock, handle: () => result.current };
}

/** A long edge `a -> c`, which `layered` routes around the middle rank. */
function addLong(s: ReturnType<typeof live>) {
  return s.scene.add({
    kind: 'mark', layer: 'main', pose: box(0, 0, 0, 0),
    data: { diagram: { from: {}, to: {} } },
    dependsOn: [s.a, s.c],
  });
}

const waypointsOf = (s: ReturnType<typeof live>, id: string): Vec2[] =>
  (s.scene.get(id as never)!.data as { diagram: { waypoints?: Vec2[] } }).diagram.waypoints ?? [];

describe('useLiveLayout with a LayoutPlanner', () => {
  it('eases to an answered plan and writes it as a built-in layout would', async () => {
    const d = deferred();
    const s = live(d.planner);
    const long = addLong(s);
    const expected = layered.plan!(graphOf(s.scene));
    const entries = s.scene.historyEntries().length;

    act(() => { s.handle().start(); });
    // Waiting on the answer counts as running, and shows nothing yet.
    expect(s.handle().isRunning()).toBe(true);
    act(() => { s.clock.frames(2); });
    expect(s.scene.overrides.ids()).toEqual([]);

    await d.answer();
    act(() => { s.clock.frames(2); });
    expect(s.scene.overrides.ids().length).toBeGreaterThan(0);
    act(() => { s.clock.frames(2); });

    expect(s.handle().isRunning()).toBe(false);
    for (const [id, at] of expected.moves) {
      const pose = s.scene.get(id as never)!.pose as RectPose;
      expect({ x: pose.x, y: pose.y }).toEqual(at);
    }
    expect(waypointsOf(s, long)).toEqual(expected.waypoints!.get(long));
    expect(s.scene.historyEntries().length).toBe(entries + 1);
    expect(d.asked).toHaveLength(1);
  });

  it('runs a planner that answers at once without waiting a tick', () => {
    const plan = vi.fn((graph: Graph) => layered.plan!(graph));
    const s = live({ plan });
    act(() => { s.handle().start(); });
    act(() => { s.clock.frames(1); });
    expect(s.scene.overrides.ids().length).toBeGreaterThan(0);
    expect(plan).toHaveBeenCalledTimes(1);
  });

  it('drops an answer that arrives after cancel or stop', async () => {
    for (const end of ['cancel', 'stop'] as const) {
      const d = deferred();
      const s = live(d.planner);
      const before = s.scene.get(s.b)!.pose;
      act(() => { s.handle().start(); });
      act(() => { s.handle()[end](); });
      expect(s.handle().isRunning()).toBe(false);
      await d.answer();
      act(() => { s.clock.frames(6); });
      expect(s.scene.get(s.b)!.pose).toEqual(before);
      expect(s.scene.overrides.ids()).toEqual([]);
    }
  });

  it('eases to the newest request when a restart supersedes one still pending', async () => {
    const d = deferred();
    const s = live(d.planner);
    act(() => { s.handle().start(); });
    act(() => { s.handle().restart(); });
    expect(d.asked).toHaveLength(2);

    // The first answer comes back after the second was asked for: ignored.
    await d.answer(0);
    act(() => { s.clock.frames(1); });
    expect(s.scene.overrides.ids()).toEqual([]);

    await d.answer(1);
    act(() => { s.clock.frames(4); });
    expect(s.handle().isRunning()).toBe(false);
    expect(s.scene.get(s.b)!.pose).not.toEqual(box(200, 30));
  });

  it('drops an answer planned for nodes that have since been dragged', async () => {
    // Held mid-drag when the answer lands, and moved by a finished drag:
    // either way the plan was made for a graph that is no longer there.
    for (const drag of ['holding', 'dropped'] as const) {
      const d = deferred();
      const s = live(d.planner);
      act(() => { s.handle().start(); });
      act(() => {
        if (drag === 'holding') s.scene.overrides.set(s.a, { pose: box(500, 500) });
        else s.scene.setPose(s.a, box(500, 500));
      });
      await d.answer();
      expect(s.handle().isRunning()).toBe(false);
      act(() => { s.clock.frames(6); });
      expect(s.scene.get(s.b)!.pose).toEqual(box(200, 30));
    }
  });

  it('asks again when the graph changes shape mid-run', async () => {
    const d = deferred();
    const s = live(d.planner);
    act(() => { s.handle().start(); });
    await d.answer();
    act(() => { s.clock.frames(2); });
    act(() => { s.scene.add({ kind: 'mark', layer: 'main', pose: box(400, 400), data: { diagram: {} } }); });
    expect(d.asked).toHaveLength(2);
    expect(d.asked[1]!.nodes).toHaveLength(4);
    await d.answer();
    act(() => { s.clock.frames(4); });
    expect(s.handle().isRunning()).toBe(false);
  });

  it('reports a planner that fails to onError, and starts nothing', async () => {
    const failure = new Error('no layout');
    const onError = vi.fn();
    const s = live({ plan: () => Promise.reject(failure) }, onError);
    act(() => { s.handle().start(); });
    await act(async () => {});
    expect(onError).toHaveBeenCalledWith(failure);
    expect(s.handle().isRunning()).toBe(false);
    act(() => { s.clock.frames(4); });
    expect(s.scene.overrides.ids()).toEqual([]);
  });

  it('logs a failure to the console when there is no onError', async () => {
    const failure = new Error('no layout');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const s = live({ plan: () => Promise.reject(failure) });
      act(() => { s.handle().start(); });
      await act(async () => {});
      expect(log).toHaveBeenCalledWith(failure);
    } finally {
      log.mockRestore();
    }
  });

  it('ignores a failure from a request already superseded', async () => {
    const rejects: ((error: unknown) => void)[] = [];
    const onError = vi.fn();
    const s = live({ plan: () => new Promise<LayoutPlan>((_, reject) => { rejects.push(reject); }) }, onError);
    act(() => { s.handle().start(); });
    act(() => { s.handle().cancel(); });
    await act(async () => { rejects[0]!(new Error('late')); });
    expect(onError).not.toHaveBeenCalled();
  });
});
