import { describe, it, expect } from 'vitest';
import { buildActionRegistry, type RegistryEntry } from './registry';
import { apply, begin } from '../result';
import { mods } from '../modifiers';
import type { ToolDef } from '../types';

const noOp = () => apply<unknown>([]);

describe('buildActionRegistry', () => {
  it('returns an empty array for no tools', () => {
    expect(buildActionRegistry([])).toEqual([]);
  });

  it('flattens click routes (plain ActionFn entries)', () => {
    const tool: ToolDef<unknown> = {
      id: 'select',
      initial: {
        click: {
          'rect': noOp,
          'empty': noOp,
        },
      },
    };
    const r = buildActionRegistry([tool]);
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', phase: 'initial', gesture: 'click', arg: undefined, target: 'rect', modifiers: 'default',
    });
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', phase: 'initial', gesture: 'click', arg: undefined, target: 'empty', modifiers: 'default',
    });
    expect(r).toHaveLength(2);
  });

  it('explodes modifier sub-tables into one row per key', () => {
    const tool: ToolDef<unknown> = {
      id: 'select',
      initial: {
        click: {
          'rect': {
            [mods()]:        noOp,
            [mods('shift')]: noOp,
            [mods('alt')]:   noOp,
          },
        },
      },
    };
    const r = buildActionRegistry([tool]);
    const targets = r.map((e) => `${e.target}/${e.modifiers}`).sort();
    expect(targets).toEqual(['rect/alt', 'rect/default', 'rect/shift']);
  });

  it('walks all phases', () => {
    const tool: ToolDef<unknown> = {
      id: 'pen',
      initial: { click: { 'empty': noOp } },
      engaged: { click: { 'anchor:first': noOp, '*': noOp } },
    };
    const r = buildActionRegistry([tool]);
    expect(r.filter((e) => e.phase === 'initial')).toHaveLength(1);
    expect(r.filter((e) => e.phase === 'engaged')).toHaveLength(2);
  });

  it('walks all gesture channels', () => {
    const tool: ToolDef<unknown> = {
      id: 'test',
      initial: {
        click:   { 'rect': noOp },
        dblTap:  { 'rect': noOp },
        drag:    { 'rect': noOp },
        wheel:   noOp,
        keyDown: { 'Escape': noOp },
        keyUp:   { 'Shift':  noOp },
      },
    };
    const r = buildActionRegistry([tool]);
    const gestures = new Set(r.map((e) => e.gesture));
    expect(gestures).toEqual(new Set(['click', 'dblTap', 'drag', 'wheel', 'keyDown', 'keyUp']));
  });

  it('function-form drag emits a single targetless row', () => {
    const tool: ToolDef<unknown> = {
      id: 'hand',
      initial: { drag: () => begin<unknown>({ scratch: undefined }) },
    };
    const r = buildActionRegistry([tool]);
    expect(r).toEqual<RegistryEntry[]>([
      { toolId: 'hand', phase: 'initial', gesture: 'drag', arg: undefined, target: undefined, modifiers: 'default' },
    ]);
  });

  it('function-form wheel emits a single arg=both row', () => {
    const tool: ToolDef<unknown> = {
      id: 'wheel-zoom',
      initial: { wheel: noOp },
    };
    const r = buildActionRegistry([tool]);
    expect(r).toEqual<RegistryEntry[]>([
      { toolId: 'wheel-zoom', phase: 'initial', gesture: 'wheel', arg: 'both', target: undefined, modifiers: 'default' },
    ]);
  });

  it('keyDown/keyUp use the key name as arg', () => {
    const tool: ToolDef<unknown> = {
      id: 'test',
      initial: { keyDown: { 'Escape': noOp, 'Enter': noOp } },
    };
    const r = buildActionRegistry([tool]);
    expect(r.map((e) => e.arg).sort()).toEqual(['Enter', 'Escape']);
    for (const e of r) expect(e.target).toBeUndefined();
  });

  it('aggregates multiple tools', () => {
    const a: ToolDef<unknown> = { id: 'a', initial: { click: { 'rect': noOp } } };
    const b: ToolDef<unknown> = { id: 'b', initial: { click: { 'text': noOp } } };
    const r = buildActionRegistry([a, b]);
    expect(r.map((e) => e.toolId).sort()).toEqual(['a', 'b']);
  });
});
