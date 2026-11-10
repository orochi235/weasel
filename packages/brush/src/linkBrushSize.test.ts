import { describe, expect, it, vi } from 'vitest';
import { createToolOptionValues, defineTool, toolOptionParams, toolOptionSteps, type ImmediateInvoker, type ToolOptions } from '@weasel-js/routing';
import { linkBrushSize, SHARED_BRUSH_SIZE, SHARED_BRUSH_SLOT } from './linkBrushSize';

const brush = (max: number): ToolOptions => ({
  actionId: 'paint',
  prefs: {
    name: 'Brush',
    description: '',
    children: {
      radiusPx: { kind: 'number', name: 'Size', description: '', default: Math.min(40, max), min: 2, max, step: 1 },
      strength: { kind: 'number', name: 'Strength', description: '', default: 0.5 },
    },
  },
  size: { option: 'radiusPx', times: 1.25 },
});

const SMUDGE = defineTool({ id: 'smudge', options: brush(400) });
const SMALL = defineTool({ id: 'small', options: brush(30) });
const PLAIN = defineTool({ id: 'select' });

describe('linkBrushSize', () => {
  it('gives every linked tool one size, set by any of them', () => {
    const inner = createToolOptionValues();
    const values = linkBrushSize(inner, [SMUDGE, SMALL, PLAIN]);
    values.set('smudge', 'radiusPx', 25);
    expect(inner.get(SHARED_BRUSH_SLOT)).toEqual({ [SHARED_BRUSH_SIZE]: 25 });
    expect(toolOptionParams('small', SMALL.options!, values).radiusPx).toBe(25);
    expect(toolOptionParams('smudge', SMUDGE.options!, values).radiusPx).toBe(25);
  });

  it("holds the shared size to each tool's own bounds", () => {
    const values = linkBrushSize(createToolOptionValues(), [SMUDGE, SMALL]);
    values.set('smudge', 'radiusPx', 120);
    expect(values.get('small').radiusPx).toBe(30);
    expect(values.get('smudge').radiusPx).toBe(120);
  });

  it('keeps each tool its own size until a shared one is set, and leaves other options per tool', () => {
    const inner = createToolOptionValues();
    inner.set('small', 'radiusPx', 12);
    const values = linkBrushSize(inner, [SMUDGE, SMALL]);
    expect(values.get('small').radiusPx).toBe(12);
    values.set('small', 'strength', 0.9);
    expect(inner.get('small').strength).toBe(0.9);
    expect(values.get('smudge').strength).toBeUndefined();
  });

  it('passes a tool it does not link straight through', () => {
    const inner = createToolOptionValues();
    const values = linkBrushSize(inner, [SMUDGE]);
    values.set('other', 'radiusPx', 7);
    expect(values.get('other')).toBe(inner.get('other'));
  });

  it('hands back the same object until a value it reads changes', () => {
    const values = linkBrushSize(createToolOptionValues(), [SMUDGE, SMALL]);
    values.set('smudge', 'radiusPx', 20);
    const first = values.get('small');
    expect(values.get('small')).toBe(first);
    values.set('smudge', 'radiusPx', 22);
    expect(values.get('small')).not.toBe(first);
  });

  it("moves every linked tool's size when one's step action runs, and notifies through the store", () => {
    const values = linkBrushSize(createToolOptionValues(), [SMUDGE, SMALL]);
    const listener = vi.fn();
    values.subscribe(listener);
    const grow = toolOptionSteps('small', 'Small', SMALL.options!).actions.find((a) => a.id === 'small.grow')!;
    (grow.invoker as ImmediateInvoker).run({ activeTool: { active: 'small' }, toolOptionValues: values } as never, undefined);
    expect(values.get('smudge').radiusPx).toBe(30);
    expect(listener).toHaveBeenCalled();
  });
});
