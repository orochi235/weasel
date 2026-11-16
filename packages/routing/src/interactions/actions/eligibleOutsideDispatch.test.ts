import { describe, expect, it, vi } from 'vitest';
import { pref } from '@weasel-js/prefs-schema';
import type { CapabilityTag } from '@weasel-js/modes';
import { buildRuleCtx, type RuleCtx } from '../../eligibility';
import type { Action } from './action';
import { ActionsNode } from './ActionsProvider';
import { createDepRegistry } from './depNode';

function ctxAllowing(...caps: CapabilityTag[]): RuleCtx {
  return buildRuleCtx({
    focused: true, selection: [], multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null }, hover: null, mode: 'free-transform', allowedCapabilities: new Set(caps),
  });
}

function scope(ruleCtx: RuleCtx | undefined) {
  const deps = createDepRegistry();
  deps.register('ruleCtx', () => () => ruleCtx);
  const node = new ActionsNode(null, true, () => deps);
  const run = vi.fn();
  const edit: Action = {
    id: 'test.edit', label: 'Edit', eligible: { capability: 'edits-page' }, invoker: { timing: 'immediate', run },
  };
  node.registry.register(edit);
  return { node, run };
}

describe("an action's eligible rule outside dispatch", () => {
  it('stops trigger in a mode that bars it', () => {
    const { node, run } = scope(ctxAllowing('transforms-selection'));
    expect(node.registry.trigger('test.edit')).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('lets trigger run where the mode allows it, or no rule context answers', () => {
    for (const ctx of [ctxAllowing('edits-page'), undefined]) {
      const { node, run } = scope(ctx);
      expect(node.registry.trigger('test.edit')).toBe(true);
      expect(run).toHaveBeenCalledTimes(1);
    }
  });

  it("disables a menu row for it, whose run does nothing", () => {
    const { node, run } = scope(ctxAllowing('transforms-selection'));
    const host = node.menuHost();
    host.define({ id: 'm', menu: { name: '', children: { edit: pref.action('test.edit') } } });
    expect(host.open({ menu: 'm', client: { x: 0, y: 0 } })).toBe(true);
    const row = host.current()!.entries[0]!;
    expect(row).toMatchObject({ kind: 'item', disabled: true });
    if (row.kind === 'item') row.run();
    expect(run).not.toHaveBeenCalled();
  });
});
