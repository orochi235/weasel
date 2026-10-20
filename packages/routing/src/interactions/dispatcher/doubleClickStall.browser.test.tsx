import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { useGestureDispatcher } from './useGestureDispatcher';

// A real long task between two real clicks: the second click happens on time,
// and the page only handles it once the task ends.

const WINDOW_MS = 600;

afterEach(cleanup);

function Surface({ onDoubleClick }: { onDoubleClick: () => void }) {
  const registry = useActionsRegistry();
  const ref = useRef<HTMLCanvasElement | null>(null);
  useGestureDispatcher({
    canvasRef: ref,
    actions: registry!,
    entriesById: new Map(),
    clientToWorld: (x, y) => ({ x, y }),
    onDoubleClick,
  });
  return <canvas ref={ref} width={200} height={100} data-testid="surface" />;
}

it('composes a double click whose second click is handled after a long task', async () => {
  const doubled = vi.fn();
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Surface onDoubleClick={doubled} /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const surface = screen.getByTestId('surface');
  const ups: { happened: number; handled: number }[] = [];
  surface.addEventListener('pointerup', (e) => { ups.push({ happened: e.timeStamp, handled: performance.now() }); });
  const r = surface.getBoundingClientRect();

  await commands.clickAcrossStall([r.left + r.width / 2, r.top + r.height / 2], WINDOW_MS + 400);

  // The premise: the releases happened inside the window and were handled outside it.
  expect(ups).toHaveLength(2);
  const [first, second] = ups as [typeof ups[0], typeof ups[0]];
  expect(second.happened - first.happened).toBeLessThan(WINDOW_MS);
  expect(second.handled - first.handled).toBeGreaterThan(WINDOW_MS);
  expect(doubled).toHaveBeenCalledOnce();
});
