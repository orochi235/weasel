import { describe, it, expect, vi } from 'vitest';
import { ActionDisabledReason, type ActionDeps } from '@weasel-js/routing';
import { editTextAtAction } from './editTextAt';

const AT = { x: 10, y: 20 };

function deps(over: { text?: { id: string; caret: number } | null; groupNamed?: boolean } = {}) {
  const startEdit = vi.fn();
  const textAt = vi.fn(() => (over.text === undefined ? { id: 't', caret: 3 } : over.text));
  const hitAt = () => ({ id: 't', kind: 'text', ...(over.groupNamed ? { doubleClick: { id: 'g', kind: 'group' } } : {}) });
  return { startEdit, textAt, deps: { textEdit: { startEdit, textAt }, hitAt } as unknown as ActionDeps };
}

function run(d: ActionDeps, world: typeof AT | undefined) {
  const inv = editTextAtAction.invoker;
  if (inv?.timing !== 'immediate') throw new Error('expected immediate invoker');
  inv.run(d, world ? { world } : undefined);
}

describe('editTextAtAction', () => {
  it('binds a double-click on a body', () => {
    expect(editTextAtAction.defaultBinding).toEqual([
      expect.objectContaining({ spec: expect.objectContaining({ kind: 'doubleClick' }), opts: { id: 'editTextAt.doubleClick' } }),
    ]);
  });

  it('opens the text under the pointer with the caret at the glyph there', () => {
    const t = deps();
    run(t.deps, AT);
    expect(t.textAt).toHaveBeenCalledWith(AT);
    expect(t.startEdit).toHaveBeenCalledWith('t', { caret: 3 });
  });

  it('opens nothing with no text under the pointer, or no point', () => {
    const t = deps({ text: null });
    run(t.deps, AT);
    run(t.deps, undefined);
    expect(t.startEdit).not.toHaveBeenCalled();
  });

  it('declines where no text is under the pointer, so another double-click takes it', () => {
    expect(editTextAtAction.enabled!(deps({ text: null }).deps, AT)).toBe(ActionDisabledReason.NotApplicable);
    expect(editTextAtAction.enabled!(deps().deps, AT)).toBe(true);
  });

  it("declines where the double-click names a group above the text, which is the group's to enter", () => {
    expect(editTextAtAction.enabled!(deps({ groupNamed: true }).deps, AT)).toBe(ActionDisabledReason.NotApplicable);
  });
});
