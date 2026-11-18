import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RectPose, Scene } from '@weasel-js/core';
import { PathMotionDemo } from '../PathMotionDemo';

const held = vi.hoisted(() => ({ scene: null as Scene<unknown, string, RectPose> | null }));
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts);
      held.scene = scene as never;
      return scene;
    },
  };
});

afterEach(cleanup);

describe('PathMotionDemo', () => {
  it('rides level once "turn with the path" is unticked after a ride that turned', () => {
    render(<PathMotionDemo />);
    const rider = () => held.scene!.get('rider' as never)!.pose;
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'ride' })); });
    expect(Math.abs(rider().rotation ?? 0)).toBeGreaterThan(1);
    act(() => { fireEvent.click(screen.getByRole('checkbox', { name: 'turn with the path' })); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'ride' })); });
    expect(rider().rotation ?? 0).toBe(0);
  });
});
