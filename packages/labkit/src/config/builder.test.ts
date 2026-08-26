import { describe, expect, it } from 'vitest';
import { f } from './builder';

describe('builder', () => {
  it('carries kind and default', () => {
    const n = f.number(20);
    expect(n.kind).toBe('number');
    expect(n.default).toBe(20);
  });

  it('chains annotations immutably', () => {
    const base = f.number(20);
    const a = base.label('A');
    const b = base.label('B');
    expect(a.annotations.name).toBe('A');
    expect(b.annotations.name).toBe('B');
    expect(base.annotations.name).toBeUndefined();
  });

  it('keeps the subclass across a chain, so kind-specific methods survive', () => {
    const n = f.number(20).label('A').range(5, 80).describe('help').step(5);
    expect(n.kind).toBe('number');
    expect(n.annotations).toMatchObject({ name: 'A', description: 'help', min: 5, max: 80, step: 5 });
  });

  it('keeps a custom node kind across a chain', () => {
    const n = f.custom('vector2', { x: 0 }).label('Offset');
    expect(n.kind).toBe('vector2');
    expect(n.annotations.name).toBe('Offset');
  });

  it('expands a bare enum option list', () => {
    const n = f.enum('fast', ['fast', 'accurate']);
    expect(n.annotations.options).toEqual([
      { value: 'fast', label: 'fast' },
      { value: 'accurate', label: 'accurate' },
    ]);
  });

  it('takes labeled enum options as given', () => {
    const n = f.enum('fast', [{ value: 'fast', label: 'Fast' }]);
    expect(n.annotations.options).toEqual([{ value: 'fast', label: 'Fast' }]);
  });

  it('f.value carries no kind', () => {
    expect(f.value(3).kind).toBeNull();
  });

  it('holds section, showIf and render off the annotation bag', () => {
    const n = f
      .number(1)
      .section('Advanced')
      .showIf((c) => c.showGrid === true)
      .render(() => null);
    expect(n.options.section).toBe('Advanced');
    expect(n.options.showIf?.({ showGrid: true })).toBe(true);
    expect(n.options.render).toBeTypeOf('function');
    expect(n.annotations).toEqual({});
  });

  it('schema.defaults() collects every default', () => {
    const s = f.schema({ showGrid: f.boolean(true), cellSize: f.number(20) });
    expect(s.defaults()).toEqual({ showGrid: true, cellSize: 20 });
  });
});
