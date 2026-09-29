import { describe, it, expect, vi } from 'vitest';
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

describe('RigDemo', () => {
  it('poses the slider figure through overrides, leaving the document and history alone', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RigDemo />);
    const scene = scenes[scenes.length - 1];
    const authored = scene.get(FOREARM)!.pose;
    const history = scene.historyEntries().length;

    const at = (v: number) => {
      act(() => { fireEvent.change(screen.getByRole('slider'), { target: { value: String(v) } }); });
      return effectivePose(scene, scene.get(FOREARM)!);
    };
    const a = at(0);
    const b = at(1);

    expect(scene.overrides.has(FOREARM)).toBe(true);
    expect(b.rotation).not.toBeCloseTo(a.rotation ?? 0, 2);
    expect(scene.get(FOREARM)!.pose).toBe(authored);
    expect(scene.historyEntries().length).toBe(history);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('reaches the slider figure\'s hand for the target, through a drag preview and after the drop', () => {
    render(<RigDemo />);
    const scene = scenes[scenes.length - 1];
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
    expect(near(hand(), centerOf(preview.pose))).toBeLessThan(0.5);

    // And commits the drop as a document pose.
    act(() => {
      scene.overrides.clear(TARGET);
      scene.setPose(TARGET, { ...scene.get(TARGET)!.pose, x: 110, y: 130 });
    });
    expect(near(hand(), centerOf(scene.get(TARGET)!.pose))).toBeLessThan(0.5);
  });
});
