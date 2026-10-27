import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { useGestureDispatcher } from '../dispatcher/useGestureDispatcher';
import { startCarry } from './carry';
import s from './carry.browser.test.module.css';

// A carry holds the press captured to its source, which jsdom only records:
// here the browser retargets every move to the source, so the canvas's own
// pointer listeners hear nothing and the carry still reaches its bindings.

afterEach(cleanup);
beforeEach(async () => {
  await page.viewport(800, 600);
});

function Surface({ actions, onPointerMove }: { actions: Action[]; onPointerMove?: () => void }) {
  const registry = useActionsRegistry();
  const ref = useRef<HTMLDivElement | null>(null);
  for (const a of actions) registry?.register(a);
  useGestureDispatcher({
    canvasRef: ref,
    actions: registry!,
    entriesById: new Map(),
    clientToWorld: (x, y) => {
      const r = ref.current!.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top };
    },
  });
  return <div ref={ref} data-testid="surface" className={s.surface} onPointerMove={onPointerMove} />;
}

function Source({ onEnd }: { onEnd?: (r: { taken: boolean }) => void }) {
  return (
    <button
      type="button"
      className={s.source}
      onPointerDown={(e) => {
        startCarry(e.currentTarget, e, { type: 'test/part', value: 'a' }, { onEnd });
      }}
    >
      part
    </button>
  );
}

function setup(ui: React.ReactNode) {
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>{ui}</ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
}

const immediate = (id: string, run: (p: unknown) => void, binding: Action['defaultBinding']): Action => ({
  id, label: id, defaultBinding: binding, invoker: { timing: 'immediate', run: (_d, p) => run(p) },
});

it('a release over the surface reaches its carry binding while no move reaches the surface itself', async () => {
  const dropped = vi.fn();
  const moved = vi.fn();
  const onEnd = vi.fn();
  setup(
    <>
      <Source onEnd={onEnd} />
      <Surface actions={[immediate('place', dropped, { kind: 'carry' })]} onPointerMove={moved} />
    </>,
  );
  await userEvent.dragAndDrop(screen.getByRole('button', { name: 'part' }), screen.getByTestId('surface'), {
    targetPosition: { x: 40, y: 60 },
  });
  expect(dropped).toHaveBeenCalledOnce();
  expect(dropped.mock.calls[0]![0]).toMatchObject({ world: { x: 40, y: 60 }, carry: { type: 'test/part', value: 'a' } });
  expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ taken: true }));
  expect(moved).not.toHaveBeenCalled();
});

it('a surface covered by another element at the release point does not take it', async () => {
  const dropped = vi.fn();
  setup(
    <>
      <Source />
      <Surface actions={[immediate('place', dropped, { kind: 'carry' })]} />
      <div data-testid="cover" className={s.cover} />
    </>,
  );
  await userEvent.dragAndDrop(screen.getByRole('button', { name: 'part' }), screen.getByTestId('cover'));
  expect(dropped).not.toHaveBeenCalled();
});
