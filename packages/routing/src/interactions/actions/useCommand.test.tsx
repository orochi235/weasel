import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useActionsRegistry } from './ActionsProvider';
import { actionItems } from './actionItems';
import { evaluateActive, evaluateEnabled } from './actionEnabled';
import { useCommand, type CommandOptions } from './useCommand';

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

interface Props {
  label: string;
  run: (params?: Readonly<Record<string, unknown>>) => void;
  options?: CommandOptions;
}

function mount(initial: Props) {
  const hook = renderHook(
    ({ label, run, options }: Props) => {
      useCommand('cmd.a', label, run, options);
      return useActionsRegistry();
    },
    { wrapper: wrap, initialProps: initial },
  );
  const registry = hook.result.current!;
  const found = () => registry.list().find((a) => a.id === 'cmd.a');
  return { ...hook, registry, found };
}

describe('useCommand', () => {
  it('registers an immediate action with the label', () => {
    const { found } = mount({ label: 'A', run: vi.fn() });
    const action = found();
    expect(action?.label).toBe('A');
    expect(action?.invoker?.timing).toBe('immediate');
  });

  it('runs the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { registry, rerender } = mount({ label: 'A', run: first });
    rerender({ label: 'A', run: second });
    registry.trigger('cmd.a');
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('does not re-register for new inline callbacks and equal options', () => {
    const { found, rerender } = mount({
      label: 'A', run: () => {}, options: { keys: { kind: 'key', key: 'r' }, tags: ['x'] },
    });
    const before = found();
    rerender({ label: 'A', run: () => {}, options: { keys: { kind: 'key', key: 'r' }, tags: ['x'] } });
    expect(found()).toBe(before);
  });

  it('re-registers when the label changes', () => {
    const { found, rerender } = mount({ label: 'A', run: vi.fn() });
    rerender({ label: 'B', run: vi.fn() });
    expect(found()?.label).toBe('B');
  });

  it('asks enabled and active through the latest options', () => {
    const run = vi.fn();
    const { found, rerender } = mount({
      label: 'A', run, options: { enabled: () => true, active: () => false },
    });
    const action = found()!;
    rerender({ label: 'A', run, options: { enabled: () => 'not-applicable', active: () => true } });
    expect(found()).toBe(action);
    expect(evaluateEnabled(action).enabled).toBe(false);
    expect(evaluateActive(action)).toBe(true);
  });

  const variants = () => [
    { key: 'a', label: 'A', params: { n: 1 } },
    { key: 'b', label: 'B', params: { n: 2 } },
  ];

  it('registers one entry per variant', () => {
    const { found } = mount({ label: 'X', run: vi.fn(), options: { variants: variants() } });
    expect(actionItems(found()!).map((i) => [i.key, i.label, i.params]))
      .toEqual([['cmd.a:a', 'A', { n: 1 }], ['cmd.a:b', 'B', { n: 2 }]]);
  });

  it('runs with the params it was triggered with', () => {
    const run = vi.fn();
    const { registry } = mount({ label: 'X', run, options: { variants: variants() } });
    registry.trigger('cmd.a', { n: 2 });
    expect(run).toHaveBeenLastCalledWith({ n: 2 });
    registry.trigger('cmd.a');
    expect(run).toHaveBeenLastCalledWith(undefined);
  });

  it('does not re-register for variants equal by value', () => {
    const run = vi.fn();
    const { found, rerender } = mount({ label: 'X', run, options: { variants: variants() } });
    const before = found();
    rerender({ label: 'X', run, options: { variants: variants() } });
    expect(found()).toBe(before);
  });

  it('re-registers when a variant changes', () => {
    const run = vi.fn();
    const { found, rerender } = mount({ label: 'X', run, options: { variants: variants() } });
    const before = found();
    const changed = variants();
    changed[1] = { key: 'b', label: 'B', params: { n: 3 } };
    rerender({ label: 'X', run, options: { variants: changed } });
    expect(found()).not.toBe(before);
    expect(actionItems(found()!).map((i) => i.params)).toEqual([{ n: 1 }, { n: 3 }]);
  });

  it('leaves the registry on unmount', () => {
    const run = vi.fn();
    const { registry, unmount } = mount({ label: 'A', run });
    unmount();
    expect(registry.list().some((a) => a.id === 'cmd.a')).toBe(false);
    expect(registry.trigger('cmd.a')).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
