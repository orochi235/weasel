import { describe, expect, it, vi } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/core';
import { renameGroupContribution } from './renameGroupAction';
import type { ReorderSource } from './editorReorder';

describe('the rename group action', () => {
  it('is disabled where its run would open no name field: with no point, as from a palette, or off every grip', () => {
    const source = { doc: { pipeline: { stages: [], groups: [] } }, boxOf: () => undefined } as unknown as ReorderSource;
    const rename = vi.fn();
    const [action] = renameGroupContribution(() => source, rename).actions!;
    expect(action!.enabled!(undefined, undefined)).not.toBe(true);
    expect(action!.enabled!(undefined, { x: 0, y: 0 })).not.toBe(true);
    (action!.invoker as ImmediateInvoker).run({}, undefined);
    expect(rename).not.toHaveBeenCalled();
  });
});
