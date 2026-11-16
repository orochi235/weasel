import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubDeps } from 'interactions/actions/testUtils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDepsFromRequires, ActionDisabledReason, BETWEEN_GESTURES, type ImmediateInvoker } from '@weasel-js/routing';
import type { DepRegistry } from '@weasel-js/routing/react';
import { registerFontOutlines } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { asNodeId } from 'core/scene/types';
import type { TextNodeSource } from '@weasel-js/text';
import { textOutlineOf } from './textOutline';
import type { TextNodeData } from './textPainter';
import { createOutlinesAction, runCreateOutlines, type CreateOutlinesAdapter } from '@weasel-js/path-tools';
import { rootsTree } from 'core/adapters/testing/rootsTree';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

function makeAdapter(texts: Record<string, TextNodeSource>, ids = Object.keys(texts)) {
  const applyOps = vi.fn();
  const adapter: CreateOutlinesAdapter = {
    ...rootsTree(),
    getSelection: () => ids.map(asNodeId),
    getOutline: (id) => (texts[id] ? textOutlineOf(texts[id].data as TextNodeData, texts[id].pose) : undefined),
    createPathNode: () => ({ id: 'outlined' }),
    applyOps,
  };
  return { adapter, applyOps };
}

const selectionOf = (ids: string[]) => ({ get: () => ids.map(asNodeId) });

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
});

describe('createOutlinesAction', () => {
  it('declares every dep it reads', () => {
    const { adapter } = makeAdapter({});
    const bag: Record<string, unknown> = { operands: selectionOf([]), createOutlinesAdapter: adapter };
    const registry = { get: (name: string) => bag[name] } as unknown as DepRegistry;
    const deps = buildDepsFromRequires(createOutlinesAction, registry);
    expect(() => createOutlinesAction.enabled?.(deps)).not.toThrow();
    expect(() => (createOutlinesAction.invoker as ImmediateInvoker).run(deps, {})).not.toThrow();
  });

  it('is enabled only while the selection holds text', () => {
    const text = { data: { text: 'a' }, pose: { x: 0, y: 0, width: 10, height: 10 } };
    const { adapter } = makeAdapter({ t: text });
    expect(createOutlinesAction.enabled?.(stubDeps({ operands: selectionOf(['t']), createOutlinesAdapter: adapter })))
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
  it('waits for faces that are still loading, then converts', async () => {
    registerFontOutlines('late-inter', {}, new Uint8Array(readFileSync(INTER_TTF)).buffer);
    const { adapter, applyOps } = makeAdapter({
      t: { data: { text: 'H', style: { fontFamily: 'late-inter', fontSize: 40 } }, pose: { x: 0, y: 0, width: 100, height: 60 } },
    });
    const result = await runCreateOutlines(adapter);
    expect(result.kind).toBe('applied');
    expect(applyOps).toHaveBeenCalledTimes(1);
  });

  it('converts what was selected when it was asked, once the face loads', async () => {
    registerFontOutlines('late-inter-2', {}, new Uint8Array(readFileSync(INTER_TTF)).buffer);
    const style = { fontFamily: 'late-inter-2', fontSize: 40 };
    const pose = { x: 0, y: 0, width: 100, height: 60 };
    let selected = ['a'];
    const converted: string[] = [];
    const { adapter } = makeAdapter({ a: { data: { text: 'H', style }, pose }, b: { data: { text: 'I', style }, pose } });
    adapter.getSelection = () => selected.map(asNodeId);
    adapter.createPathNode = (_path, source) => { converted.push(source); return { id: `outlined-${source}` }; };
    const pending = runCreateOutlines(adapter);
    selected = ['b'];
    expect((await pending).kind).toBe('applied');
    expect(converted).toEqual(['a']);
  });

  it('warns and changes nothing when a face has no outlines at all', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { adapter, applyOps } = makeAdapter({
      t: { data: { text: 'H', style: { fontFamily: 'nowhere', fontSize: 40 } }, pose: { x: 0, y: 0, width: 100, height: 60 } },
    });
    const result = await runCreateOutlines(adapter);
    expect(result.kind).toBe('failed');
    expect(applyOps).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nowhere'));
    warn.mockRestore();
  });

  it("tells the user through the host's notices when it has them", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const notices = { warn: vi.fn() };
    const { adapter } = makeAdapter({
      t: { data: { text: 'H', style: { fontFamily: 'nowhere', fontSize: 40 } }, pose: { x: 0, y: 0, width: 100, height: 60 } },
    });
    await runCreateOutlines(adapter, notices);
    expect(notices.warn).toHaveBeenCalledWith(expect.stringContaining('nowhere'), expect.objectContaining({ id: 'outlines' }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
