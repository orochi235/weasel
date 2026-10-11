/**
 * A multitouch gesture ends when the hand that made it changes, and ending it
 * ends nothing else: a drag another pointer opened earlier stays in flight.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useAction, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});

function ongoing(id: string, log: string[]): Action {
  return {
    id, label: id,
    invoker: {
      timing: 'ongoing',
      start: () => {
        log.push(`start:${id}`);
        return {
          kind: id,
          onMove: () => { log.push(`move:${id}`); },
          onEnd: (_ctx, reason) => { log.push(`end:${id}:${reason}`); },
        };
      },
    },
  };
}

const tap = (log: string[]): Action => ({
  id: 'tap', label: 'tap',
  invoker: { timing: 'immediate', run: () => { log.push('tap'); } },
});

const touch: Contribution = {
  id: 'touch',
  eligibility: { always: true },
  bindings: [
    { spec: { kind: 'drag' }, actionId: 'move' },
    { spec: { kind: 'multiTouch', fingers: 2 }, actionId: 'zoom' },
    { spec: { kind: 'multiTouch', fingers: 3 }, actionId: 'swipe' },
    { spec: { kind: 'multiTouchTap', fingers: 2 }, actionId: 'tap' },
  ],
};
const ENTRIES = new Map([[touch.id, touch]]);

function Mount({ actions }: { actions: Action[] }): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const registry = useActionsRegistry();
  useAction(actions[0]!);
  useAction(actions[1]!);
  useAction(actions[2]!);
  useAction(actions[3]!);
  useGestureDispatcher({ canvasRef, actions: registry!, entriesById: ENTRIES });
  return <canvas ref={canvasRef} data-testid="c" />;
}

function mount(): { log: string[]; fire: (type: string, pointerId: number, x: number) => void } {
  const log: string[] = [];
  const actions = [...['move', 'zoom', 'swipe'].map((id) => ongoing(id, log)), tap(log)];
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount actions={actions} /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const canvas = document.querySelector('[data-testid="c"]')!;
  const fire = (type: string, pointerId: number, x: number): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId, pointerType: 'touch', clientX: x, clientY: 0,
      }));
    });
  };
  return { log, fire };
}

const ends = (log: string[]): string[] => log.filter((l) => l.startsWith('end:'));

describe('lifting a finger from a multitouch gesture', () => {
  it('ends the pinch and leaves another pointer\'s drag in flight', () => {
    const { log, fire } = mount();
    fire('pointerdown', 1, 0);
    fire('pointermove', 1, 50);
    expect(log).toContain('start:move');
    fire('pointerdown', 2, 200);
    expect(log).toContain('start:zoom');

    fire('pointerup', 2, 200);
    expect(ends(log)).toEqual(['end:zoom:commit']);

    log.length = 0;
    fire('pointermove', 1, 80);
    expect(log).toEqual(['move:move']);
    fire('pointerup', 1, 80);
    expect(ends(log)).toEqual(['end:move:commit']);
  });

  it('ends a three-finger gesture once when the fingers lift one at a time', () => {
    const { log, fire } = mount();
    fire('pointerdown', 1, 0);
    fire('pointerdown', 2, 100);
    fire('pointerdown', 3, 200);
    expect(log).toEqual(['start:zoom', 'end:zoom:cancel', 'start:swipe']);

    log.length = 0;
    fire('pointerup', 3, 200);
    expect(log).toEqual(['end:swipe:commit']);
    fire('pointermove', 2, 120);
    fire('pointerup', 2, 120);
    fire('pointerup', 1, 0);
    expect(log).toEqual(['end:swipe:commit']);
  });

  it('cancels the pinch when one of its pointers is canceled', () => {
    const { log, fire } = mount();
    fire('pointerdown', 1, 0);
    fire('pointerdown', 2, 100);

    fire('pointercancel', 2, 100);
    expect(ends(log)).toEqual(['end:zoom:cancel']);
    fire('pointerup', 1, 0);
    expect(ends(log)).toEqual(['end:zoom:cancel']);
  });
});

describe('a two-finger tap', () => {
  it('fires when both fingers land and lift in place', () => {
    const { log, fire } = mount();
    fire('pointerdown', 1, 100);
    fire('pointerdown', 2, 200);
    fire('pointerup', 2, 200);
    fire('pointerup', 1, 100);
    expect(log.filter((l) => l === 'tap')).toEqual(['tap']);
  });

  it('does not fire after a pinch that kept its center still', () => {
    const { log, fire } = mount();
    fire('pointerdown', 1, 100);
    fire('pointerdown', 2, 200);
    fire('pointermove', 1, 50);
    fire('pointermove', 2, 250);
    fire('pointerup', 2, 250);
    fire('pointerup', 1, 50);
    expect(log).not.toContain('tap');
  });
});
