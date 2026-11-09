import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useActionsRegistry } from './ActionsProvider';
import { actionItems } from './actionItems';
import { actionShortcuts } from './actionShortcuts';
import { actionBindings } from './binding';
import { evaluateActive, evaluateEnabled } from './actionEnabled';
import type { ActionUnavailable, ActionVariant } from './action';
import { useCommand, type CommandOptions } from './useCommand';
import { toIconRef } from '@weasel-js/icons';

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
  it('files the action under `group`', () => {
    const { found } = mount({ label: 'A', run: vi.fn(), options: { group: 'app' } });
    expect(found()?.group).toBe('app');
  });

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

  it('does not re-register for an inline icon with a mark, equal by value', () => {
    const { found, rerender } = mount({ label: 'A', run: () => {}, options: { icon: { name: toIconRef('ui:layers')!, mark: toIconRef('ui:markAdd')! } } });
    const before = found();
    rerender({ label: 'A', run: () => {}, options: { icon: { name: toIconRef('ui:layers')!, mark: toIconRef('ui:markAdd')! } } });
    expect(found()).toBe(before);
  });

  it('gives each variant its own key through keys in the { spec, opts } form', () => {
    const run = vi.fn();
    const { found } = mount({
      label: 'Zoom', run, options: {
        variants: [{ key: 'in', label: 'In', params: { dir: 'in' } }, { key: 'out', label: 'Out', params: { dir: 'out' } }],
        keys: [
          { spec: { kind: 'key', key: '=' }, opts: { params: { dir: 'in' } } },
          { spec: { kind: 'key', key: '-' }, opts: { params: { dir: 'out' } } },
        ],
      },
    });
    const action = found()!;
    expect(actionShortcuts(action, { dir: 'in' }).map((s) => s.key)).toEqual(['=']);
    expect(actionShortcuts(action, { dir: 'out' }).map((s) => s.key)).toEqual(['-']);
  });

  it('takes a lone { spec, opts } as keys', () => {
    const { found } = mount({
      label: 'Zoom', run: vi.fn(), options: { keys: { spec: { kind: 'key', key: '=' }, opts: { params: { dir: 'in' } } } },
    });
    expect(actionBindings(found()!)).toEqual([{ spec: { kind: 'key', key: '=' }, actionId: 'cmd.a', opts: { params: { dir: 'in' } } }]);
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

  it('lets enabled answer with a sentence, which reaches every surface as the reason', () => {
    expectTypeOf<ReturnType<NonNullable<CommandOptions['enabled']>>>().toEqualTypeOf<true | ActionUnavailable>();
    const { found } = mount({ label: 'A', run: vi.fn(), options: { enabled: () => 'Open a document first' } });
    expect(evaluateEnabled(found()!)).toEqual({ enabled: false, reason: 'Open a document first' });
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

  it('asks enabled and active with each variant\'s params, and trigger with its own', () => {
    const run = vi.fn();
    const { found, registry } = mount({
      label: 'X', run, options: {
        variants: variants(),
        enabled: (p) => (p?.n === 2 ? 'Not for two' : true),
        active: (p) => p?.n === 1,
      },
    });
    const [a, b] = actionItems(found()!);
    expect(evaluateEnabled(a!.action, undefined, undefined, a!.params)).toEqual({ enabled: true });
    expect(evaluateEnabled(b!.action, undefined, undefined, b!.params)).toEqual({ enabled: false, reason: 'Not for two' });
    expect([evaluateActive(a!.action, undefined, a!.params), evaluateActive(b!.action, undefined, b!.params)]).toEqual([true, false]);
    expect(registry.trigger('cmd.a', { n: 2 })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('carries shortcut text, description and grade', () => {
    const { found } = mount({
      label: 'Wipe', run: vi.fn(), options: { shortcut: '⌘⌫', description: 'Clear the page', grade: 'danger' },
    });
    expect(found()).toMatchObject({ shortcut: '⌘⌫', description: 'Clear the page', grade: 'danger' });
  });

  it('previews through the latest callback, with the params asked for', () => {
    const stop = vi.fn();
    const first = vi.fn(() => stop);
    const second = vi.fn(() => stop);
    const { registry, rerender } = mount({ label: 'A', run: vi.fn(), options: { preview: first } });
    rerender({ label: 'A', run: vi.fn(), options: { preview: second } });
    registry.preview('cmd.a', { n: 1 })();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ n: 1 });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('carries a settings form whose read and params are the latest', () => {
    const schema = { name: 'Size', children: {} };
    const { found, rerender } = mount({
      label: 'A', run: vi.fn(), options: { settings: { schema, read: () => ({ values: { w: 1 } }) } },
    });
    const action = found()!;
    rerender({
      label: 'A', run: vi.fn(), options: {
        settings: { schema: { name: 'Size', children: {} }, read: () => ({ values: { w: 2 } }), params: (path, value) => ({ [path]: value, again: true }) },
      },
    });
    const settings = found()!.settings!;
    expect(settings.schema).toEqual(schema);
    expect(settings.read({})).toEqual({ values: { w: 2 } });
    expect(settings.params?.('w', 3)).toEqual({ w: 3, again: true });
    expect(found()).not.toBe(action);
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

describe('CommandOptions.variants', () => {
  it('takes ActionVariants, tags included', () => {
    expectTypeOf<CommandOptions['variants']>().toEqualTypeOf<readonly ActionVariant[] | undefined>();
    const tagged: ActionVariant = { key: 'a4', label: 'A4', tags: ['paper'], params: { size: 'a4' } };
    const options: CommandOptions = { variants: [tagged] };
    expect(options.variants).toHaveLength(1);
  });
});
