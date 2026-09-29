import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDepsFromRequires, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import type { DepRegistry } from '@weasel-js/routing/react';
import { registerFontOutlines } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { asNodeId } from 'core/scene/types';
import type { TextNodeSource } from 'features/text/textToPath';
import type { CreateOutlinesAdapter } from '../outlines/createOutlines';
import { createOutlinesAction, runCreateOutlines } from './createOutlines';

const INTER_TTF = resolve(import.meta.dirname, '../../../../../../assets/fonts/inter/inter.ttf');

function makeAdapter(texts: Record<string, TextNodeSource>, ids = Object.keys(texts)) {
  const applyOps = vi.fn();
  const adapter: CreateOutlinesAdapter = {
    getSelection: () => ids.map(asNodeId),
    getTextSource: (id) => texts[id],
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
    const bag: Record<string, unknown> = { selection: selectionOf([]), createOutlinesAdapter: adapter };
    const registry = { get: (name: string) => bag[name] } as unknown as DepRegistry;
    const deps = buildDepsFromRequires(createOutlinesAction, registry);
    expect(() => createOutlinesAction.enabled?.(deps)).not.toThrow();
    expect(() => (createOutlinesAction.invoker as ImmediateInvoker).run(deps, {})).not.toThrow();
  });

  it('is enabled only while the selection holds text', () => {
    const text = { data: { text: 'a' }, pose: { x: 0, y: 0, width: 10, height: 10 } };
    const { adapter } = makeAdapter({ t: text });
    expect(createOutlinesAction.enabled?.({ selection: selectionOf(['t']), createOutlinesAdapter: adapter }))
      .toBe(true);
    expect(createOutlinesAction.enabled?.({ selection: selectionOf(['shape']), createOutlinesAdapter: adapter }))
      .toBe(ActionDisabledReason.NotApplicable);
    expect(createOutlinesAction.enabled?.({ selection: selectionOf([]), createOutlinesAdapter: adapter }))
      .toBe(ActionDisabledReason.SelectionRequired);
  });

  it('binds the conventional Shift+Mod+O', () => {
    expect(createOutlinesAction.defaultBinding).toEqual({ kind: 'key', key: 'o', mods: { mod: true, shift: true } });
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
});
