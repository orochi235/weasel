import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { enterPathEditAction } from './enterPathEdit';

function run(opts: { selected: string[]; editable: string[]; under: string | null }) {
  const setEditingId = vi.fn();
  const deps = {
    editAnchors: { getEditablePath: (id: string) => (opts.editable.includes(id) ? {} : null), setEditingId },
    selection: { get: () => opts.selected },
    nodeAtPoint: () => opts.under,
  };
  (enterPathEditAction.invoker as ImmediateInvoker).run(deps as never, { worldX: 5, worldY: 5 });
  return setEditingId;
}

describe('enterPathEdit', () => {
  it('opens the editable path under the pointer, not the first selected one', () => {
    expect(run({ selected: ['a', 'b'], editable: ['a', 'b'], under: 'b' })).toHaveBeenCalledWith('b');
  });

  it('falls back to the first selected editable path when none is under the pointer', () => {
    expect(run({ selected: ['r', 'a'], editable: ['a'], under: null })).toHaveBeenCalledWith('a');
    expect(run({ selected: ['r', 'a'], editable: ['a'], under: 'r' })).toHaveBeenCalledWith('a');
  });

  it('stands aside where the double-click names a group above the path under it', () => {
    const hitAt = (named: string | undefined) => () => ({
      bodyTarget: 'unselected-body' as const, bodyKind: 'path', id: 'member',
      ...(named ? { doubleClick: { bodyTarget: 'unselected-body' as const, bodyKind: 'group', id: named } } : {}),
    });
    const enabled = enterPathEditAction.enabled!;
    expect(enabled({ hitAt: hitAt('outer') } as never, { x: 5, y: 5 })).toBe(ActionDisabledReason.NotApplicable);
    expect(enabled({ hitAt: hitAt(undefined) } as never, { x: 5, y: 5 })).toBe(true);
  });
});
