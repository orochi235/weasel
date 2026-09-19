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
});
