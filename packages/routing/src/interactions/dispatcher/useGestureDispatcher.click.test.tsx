/**
 * A press released where it went down is a click, and a second one soon after
 * and close by is a double click. The observers bracket the dispatches: a
 * click's runs after its binding, a double click's before.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
afterEach(() => { vi.useRealTimers(); });

const entry: Contribution = {
  id: 'clicks',
  eligibility: { always: true },
  bindings: [
    { spec: { kind: 'click' }, actionId: 'click' },
    { spec: { kind: 'doubleClick' }, actionId: 'double' },
  ],
};
const ENTRIES = new Map([[entry.id, entry]]);

const immediate = (id: string, log: string[]): Action => ({
  id, label: id, invoker: { timing: 'immediate', run: () => { log.push(id); } },
});

function Mount({ log, keyboard }: { log: string[]; keyboard: boolean }): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const registry = useActionsRegistry();
  const actions = useRef([immediate('click', log), immediate('double', log)]).current;
  useAction(actions[0]!);
  useAction(actions[1]!);
  useGestureDispatcher({
    canvasRef, actions: registry!, entriesById: ENTRIES, keyboard,
    onClick: () => { log.push('onClick'); },
    onDoubleClick: () => { log.push('onDoubleClick'); },
  });
  return <canvas ref={canvasRef} data-testid="c" />;
}

function mount(): { log: string[]; click: (x?: number) => void; remount: () => void } {
  const log: string[] = [];
  const tree = (keyboard: boolean): ReactNode => (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount log={log} keyboard={keyboard} /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
  const { rerender } = render(tree(true));
  const canvas = document.querySelector('[data-testid="c"]')!;
  const click = (x = 5): void => {
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: 5, pointerId: 1 }));
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: 5, pointerId: 1 }));
    });
  };
  // `keyboard` is one of the attach effect's dependencies, so this re-binds every listener.
  return { log, click, remount: () => { rerender(tree(false)); } };
}

/** Both clocks: a double click has been timed by each. */
const fakeClocks = (): void => {
  vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'] });
};

describe('a press released in place', () => {
  it('clicks, and tells the click observer after the binding ran', () => {
    const { log, click } = mount();
    click();
    expect(log).toEqual(['click', 'onClick']);
  });

  it('double-clicks on the second, telling the double-click observer before the binding runs', () => {
    const { log, click } = mount();
    click();
    click();
    expect(log).toEqual(['click', 'onClick', 'click', 'onClick', 'onDoubleClick', 'double']);
  });

  it('starts over after a double click, so a third click composes nothing', () => {
    const { log, click } = mount();
    click();
    click();
    click();
    expect(log.filter((l) => l === 'double')).toHaveLength(1);
  });

  it('does not double-click when the second click comes too late', () => {
    fakeClocks();
    const { log, click } = mount();
    click();
    vi.advanceTimersByTime(600);
    click();
    expect(log).not.toContain('double');
  });

  it('double-clicks just inside the window', () => {
    fakeClocks();
    const { log, click } = mount();
    click();
    vi.advanceTimersByTime(599);
    click();
    expect(log).toContain('double');
  });

  it('does not double-click when the second click lands too far away', () => {
    const { log, click } = mount();
    click(5);
    click(13);
    expect(log).not.toContain('double');
  });

  it('remembers the first click across a re-bind of its listeners', () => {
    const { log, click, remount } = mount();
    click();
    remount();
    click();
    expect(log).toContain('double');
  });
});
