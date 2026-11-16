/**
 * The Create Outlines action and its retry over outlines still loading, through a stub outline. A
 * text face loading for real is text-tools' `textOutline.createOutlinesAction.test.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import { rootsTreeForTests as rootsTree, stubDepsForTests as stubDeps } from '@weasel-js/core/test-seams';
import { buildDepsFromRequires, ActionDisabledReason, BETWEEN_GESTURES, type ImmediateInvoker } from '@weasel-js/routing';
import type { DepRegistry } from '@weasel-js/routing/react';
import { asNodeId, NodeOutlineError, type NodeOutline } from '@weasel-js/core';
import type { CreateOutlinesAdapter } from './createOutlines';
import { createOutlinesAction, runCreateOutlines } from './createOutlinesAction';

/** An outline that throws `pending` until `load()` settles, or for good when `never` lands. */
function lateOutline({ never = false }: { never?: boolean } = {}): NodeOutline {
  let landed = false;
  const parts = () => {
    if (!landed || never) {
      throw new NodeOutlineError('not yet', { summary: 'The gem "nowhere" is uncut', pending: !landed });
    }
    return [{ path: rectPath(0, 0, 10, 10), fill: { paint: { kind: 'solid', color: '#000' } } }] as const;
  };
  return {
    stroked: false,
    path: () => parts()[0].path,
    parts,
    load: () => { landed = true; return Promise.resolve(); },
  };
}

function makeAdapter(outlines: Record<string, NodeOutline>, ids = Object.keys(outlines)) {
  const applyOps = vi.fn();
  const adapter: CreateOutlinesAdapter = {
    ...rootsTree(),
    getSelection: () => ids.map(asNodeId),
    getOutline: (id) => outlines[id],
    createPathNode: () => ({ id: 'outlined' }),
    applyOps,
  };
  return { adapter, applyOps };
}

const selectionOf = (ids: string[]) => ({ get: () => ids.map(asNodeId) });

describe('createOutlinesAction', () => {
  it('declares every dep it reads', () => {
    const { adapter } = makeAdapter({});
    const bag: Record<string, unknown> = { operands: selectionOf([]), createOutlinesAdapter: adapter };
    const registry = { get: (name: string) => bag[name] } as unknown as DepRegistry;
    const deps = buildDepsFromRequires(createOutlinesAction, registry);
    expect(() => createOutlinesAction.enabled?.(deps)).not.toThrow();
    expect(() => (createOutlinesAction.invoker as ImmediateInvoker).run(deps, {})).not.toThrow();
  });

  it('is enabled only while the selection holds a node with an outline', () => {
    const { adapter } = makeAdapter({ g: lateOutline() });
    expect(createOutlinesAction.enabled?.(stubDeps({ operands: selectionOf(['g']), createOutlinesAdapter: adapter })))
      .toBe(true);
    expect(createOutlinesAction.enabled?.(stubDeps({ operands: selectionOf(['shape']), createOutlinesAdapter: adapter })))
      .toBe(ActionDisabledReason.NotApplicable);
    expect(createOutlinesAction.enabled?.(stubDeps({ operands: selectionOf([]), createOutlinesAdapter: adapter })))
      .toBe(ActionDisabledReason.SelectionRequired);
  });

  it("binds Affinity's Mod+Enter", () => {
    expect(createOutlinesAction.defaultBinding).toEqual([{ spec: { kind: 'key', key: 'Enter', mods: { mod: true }, phase: BETWEEN_GESTURES }, opts: { id: 'createOutlines.key' } }]);
  });
});

describe('runCreateOutlines', () => {
  it('waits for outlines that are still loading, then converts', async () => {
    const { adapter, applyOps } = makeAdapter({ g: lateOutline() });
    const result = await runCreateOutlines(adapter);
    expect(result.kind).toBe('applied');
    expect(applyOps).toHaveBeenCalledTimes(1);
  });

  it('converts what was selected when it was asked, once the outline loads', async () => {
    let selected = ['a'];
    const converted: string[] = [];
    const { adapter } = makeAdapter({ a: lateOutline(), b: lateOutline() });
    adapter.getSelection = () => selected.map(asNodeId);
    adapter.createPathNode = (_path, source) => { converted.push(source); return { id: `outlined-${source}` }; };
    const pending = runCreateOutlines(adapter);
    selected = ['b'];
    expect((await pending).kind).toBe('applied');
    expect(converted).toEqual(['a']);
  });

  it('warns and changes nothing when an outline cannot be built at all', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { adapter, applyOps } = makeAdapter({ g: lateOutline({ never: true }) });
    const result = await runCreateOutlines(adapter);
    expect(result.kind).toBe('failed');
    expect(applyOps).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nowhere'));
    warn.mockRestore();
  });

  it("tells the user through the host's notices when it has them", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const notices = { warn: vi.fn() };
    const { adapter } = makeAdapter({ g: lateOutline({ never: true }) });
    await runCreateOutlines(adapter, notices);
    expect(notices.warn).toHaveBeenCalledWith(expect.stringContaining('nowhere'), expect.objectContaining({ id: 'outlines' }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
