/** A hold's release asks again whether the action may run. */
import { describe, expect, it, vi } from 'vitest';
import type { RuleCtx } from '../../eligibility';
import type { Action } from './action';
import type { InvocationCtx, OngoingInvoker } from './invoker';
import { holdPreview } from './holdPreview';

function release(action: Action, deps: Record<string, unknown>): void {
  const invoker = holdPreview(action).invoker as OngoingInvoker;
  const ctx = { deps, world: { x: 0, y: 0 } } as unknown as InvocationCtx;
  invoker.start(ctx).onEnd?.(ctx, 'commit');
}

describe('holdPreview release', () => {
  it('runs nothing when the eligible rule refuses by the release', () => {
    let allowed = true;
    const run = vi.fn();
    const action: Action = { id: 'a', label: 'A', eligible: { when: () => allowed }, invoker: { timing: 'immediate', run } };
    const hold = holdPreview(action);
    expect(hold.requires).toContain('ruleCtx');
    const invoker = hold.invoker as OngoingInvoker;
    const ctx = { deps: { ruleCtx: () => ({}) as RuleCtx }, world: { x: 0, y: 0 } } as unknown as InvocationCtx;
    const handle = invoker.start(ctx);
    allowed = false;
    handle.onEnd?.(ctx, 'commit');
    expect(run).not.toHaveBeenCalled();
    release(action, { ruleCtx: () => ({}) as RuleCtx });
    expect(run).not.toHaveBeenCalled();
    allowed = true;
    release(action, { ruleCtx: () => ({}) as RuleCtx });
    expect(run).toHaveBeenCalledOnce();
  });

});
