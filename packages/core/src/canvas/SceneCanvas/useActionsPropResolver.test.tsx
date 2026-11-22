import { describe, expect, it, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import type { Action, ActionsProp, ActionsRegistry } from '@weasel-js/routing';
import { ActionsProvider, useActionsRegistry } from '@weasel-js/routing/react';
import { useActionsPropResolver } from './useActionsPropResolver';

const action = (id: string, label: string): Action => ({ id, label, invoker: { kind: 'immediate', run: () => {} } } as unknown as Action);

/** Resolves `actions`, then registers `late` in a later effect of the same commit, as a tool's actions are. */
function Canvas({ actions, late, onReg }: { actions: ActionsProp; late: Action; onReg: (r: ActionsRegistry) => void }): ReactNode {
  const reg = useActionsRegistry()!;
  useActionsPropResolver(actions);
  useEffect(() => reg.register(late), [reg, late]);
  onReg(reg);
  return null;
}

describe('useActionsPropResolver', () => {
  const mount = (actions: ActionsProp, late: Action) => {
    let reg: ActionsRegistry | null = null;
    const out = render(<ActionsProvider><Canvas actions={actions} late={late} onReg={(r) => { reg = r; }} /></ActionsProvider>);
    return { ...out, reg: () => reg!, rerenderLate: (next: Action) => out.rerender(<ActionsProvider><Canvas actions={actions} late={next} onReg={(r) => { reg = r; }} /></ActionsProvider>) };
  };

  it('merges a partial entry onto an action registered after it, with no warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { reg } = mount({ 'tool.sides': { label: 'Sides' } }, action('tool.sides', 'Adjust sides'));
    expect(reg().list().find((a) => a.id === 'tool.sides')?.label).toBe('Sides');
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns of a partial entry no action ever takes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount({ 'nobody.home': { label: 'Nobody' } }, action('tool.sides', 'Adjust sides'));
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('keeps the merge on top when the action re-registers', () => {
    const actions = { 'tool.sides': { label: 'Sides' } };
    const m = mount(actions, action('tool.sides', 'Adjust sides'));
    m.rerenderLate(action('tool.sides', 'Adjust sides again'));
    expect(m.reg().list().find((a) => a.id === 'tool.sides')?.label).toBe('Sides');
  });

  it('leaves an action registered after actions={null} live, as a tool\'s own are', () => {
    const { reg } = mount(null, action('tool.sides', 'Adjust sides'));
    expect(reg().list().map((a) => a.id)).toContain('tool.sides');
  });

  it("re-merges onto the default once a sibling canvas's merge beneath it unmounts", () => {
    const run = () => {};
    const forA = { 'tool.sides': { invoker: { kind: 'immediate', run } } } as never;
    const forB = { 'tool.sides': { label: 'B' } };
    const A = () => { useActionsPropResolver(forA); return null; };
    const B = ({ onReg }: { onReg: (r: ActionsRegistry) => void }) => {
      onReg(useActionsRegistry()!);
      useActionsPropResolver(forB);
      return null;
    };
    const Default = () => {
      const reg = useActionsRegistry()!;
      useEffect(() => reg.register(action('tool.sides', 'Adjust sides')), [reg]);
      return null;
    };
    let reg: ActionsRegistry | null = null;
    const tree = (withA: boolean) => (
      <ActionsProvider><Default />{withA ? <A /> : null}<B onReg={(r) => { reg = r; }} /></ActionsProvider>
    );
    const out = render(tree(true));
    const live = () => reg!.list().find((a) => a.id === 'tool.sides') as unknown as { label: string; invoker: { run: unknown } };
    expect(live().label).toBe('B');
    expect(live().invoker.run).toBe(run);
    out.rerender(tree(false));
    expect(live().label).toBe('B');
    expect(live().invoker.run).not.toBe(run);
  });
});
