import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, type Scene } from '@weasel-js/core';
import { BooleanOpsDemo } from '../BooleanOpsDemo';

const held = vi.hoisted(() => ({ scenes: [] as Scene<unknown, string, unknown>[] }));
vi.mock('@weasel-js/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@weasel-js/core')>();
  return {
    ...core,
    useScene: (opts: never) => {
      const scene = core.useScene(opts);
      if (!held.scenes.includes(scene as never)) held.scenes.push(scene as never);
      return scene;
    },
  };
});

afterEach(cleanup);

describe('BooleanOpsDemo', () => {
  it('unites its two inputs through the adapter the canvas publishes', () => {
    render(<BooleanOpsDemo />);
    const scene = held.scenes.find((s) => s.get(asNodeId('rect')) && s.get(asNodeId('circle')))!;
    fireEvent.click(screen.getByRole('button', { name: /Unite/ }));
    const ids = [...scene.renderOrder()];
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toMatch(/^(rect|circle)$/);
    expect((scene.get(ids[0]!)!.data as { path?: { kind: string } }).path?.kind).toBe('polygon');
  });
});
