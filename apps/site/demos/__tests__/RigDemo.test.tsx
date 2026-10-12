import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, effectivePose } from '@weasel-js/core';
import type { RectPose, Scene } from '@weasel-js/core';
import { RigDemo } from '../RigDemo';

const scenes: Scene<unknown, string, RectPose>[] = [];
vi.mock('@weasel-js/core', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...real,
    useScene: (...args: Parameters<typeof real.useScene>) => {
      const scene = real.useScene(...args);
      scenes.push(scene as unknown as Scene<unknown, string, RectPose>);
      return scene;
    },
  };
});

const FOREARM = asNodeId('slider:bone:forearm');
const THIGH = asNodeId('slider:bone:thigh');
const TRACK_THIGH = asNodeId('track:bone:thigh');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});
afterEach(() => {
  vi.useRealTimers();
});

// A rig shows what is on its target once a frame, so a change reads back after one.
const frame = (ms = 20) => act(() => { vi.advanceTimersByTime(ms); });
const slide = (name: RegExp, v: number) => {
  act(() => { fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(v) } }); });
  frame();
};
const mount = () => {
  render(<RigDemo />);
  frame();
  return scenes[scenes.length - 1];
};
const turn = (scene: Scene<unknown, string, RectPose>, id: typeof THIGH) =>
  effectivePose(scene, scene.get(id)!).rotation ?? 0;

describe('RigDemo', () => {
  it('poses the slider figure through overrides, leaving the document and history alone', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scene = mount();
    const authored = scene.get(FOREARM)!.pose;
    const history = scene.historyEntries().length;

    slide(/blend/, 0);
    const a = effectivePose(scene, scene.get(FOREARM)!);
    slide(/blend/, 1);
    const b = effectivePose(scene, scene.get(FOREARM)!);

    expect(scene.overrides.has(FOREARM)).toBe(true);
    expect(b.rotation).not.toBeCloseTo(a.rotation ?? 0, 2);
    expect(scene.get(FOREARM)!.pose).toBe(authored);
    expect(scene.historyEntries().length).toBe(history);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('mixes the two body poses by the slider\'s weights', () => {
    const scene = mount();
    slide(/blend/, 0);
    const a = turn(scene, THIGH);
    slide(/blend/, 1);
    const b = turn(scene, THIGH);
    expect(Math.abs(b - a)).toBeCloseTo(0.95, 6);
    slide(/blend/, 0.25);
    expect(turn(scene, THIGH)).toBeCloseTo(a + (b - a) * 0.25, 6);
    // The leg is out of the arm's chain, so the reach weight leaves the mix as it is.
    slide(/reach/, 0.4);
    expect(turn(scene, THIGH)).toBeCloseTo(a + (b - a) * 0.25, 6);
  });

  it('reaches the slider figure\'s hand for the target, through a drag preview and after the drop', () => {
    const scene = mount();
    const TARGET = asNodeId('slider:target');
    const hand = () => {
      const p = effectivePose(scene, scene.get(FOREARM)!);
      const r = p.rotation ?? 0;
      return [p.x + p.width / 2 + (p.width / 2) * Math.cos(r), p.y + p.height / 2 + (p.width / 2) * Math.sin(r)];
    };
    const centerOf = (p: RectPose) => [p.x + p.width / 2, p.y + p.height / 2];
    const near = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

    expect(scene.isLocked(FOREARM)).toBe(true);
    expect(scene.isLocked(TARGET)).toBe(false);
    expect(near(hand(), centerOf(scene.get(TARGET)!.pose))).toBeLessThan(0.5);

    // The move action previews a drag through the scene's overrides.
    const preview = { pose: { ...scene.get(TARGET)!.pose, x: 200, y: 90 } };
    act(() => { scene.overrides.set(TARGET, preview); scene.overrides.commit(); });
    frame();
    expect(near(hand(), centerOf(preview.pose))).toBeLessThan(0.5);

    // And commits the drop as a document pose.
    act(() => {
      scene.overrides.clear(TARGET);
      scene.setPose(TARGET, { ...scene.get(TARGET)!.pose, x: 110, y: 130 });
    });
    frame();
    expect(near(hand(), centerOf(scene.get(TARGET)!.pose))).toBeLessThan(0.5);

    // At no reach the arm is the body's own.
    slide(/reach/, 0);
    expect(near(hand(), centerOf(scene.get(TARGET)!.pose))).toBeGreaterThan(5);
  });

  it('plays the track figure from a pose track on its rig, and returns it to A when stopped', () => {
    const scene = mount();
    const atA = turn(scene, TRACK_THIGH);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'play track' })); });
    frame();
    frame(1400);
    // The second key is pose B, whose thigh sits 0.95 from A's.
    expect(Math.abs(turn(scene, TRACK_THIGH) - atA)).toBeCloseTo(0.95, 2);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'stop track' })); });
    frame();
    expect(turn(scene, TRACK_THIGH)).toBeCloseTo(atA, 6);
    expect(screen.getByText(/track u/).textContent).toBe('track u 1.00');
  });
});
