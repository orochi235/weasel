import { describe, expect, it } from 'vitest';
import { f } from './builder';
import type { ConfigOf, ConfigPath, ValueAtPath } from './types';

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
    expect(n.annotations).toMatchObject({
      name: 'A',
      description: 'help',
      min: 5,
      max: 80,
      step: 5,
    });
  });

  it('annotates a number with a display suffix', () => {
    const n = f.number(20).suffix('px');
    expect(n.annotations.suffix).toBe('px');
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
    expect(n.options.section).toEqual({ label: 'Advanced' });
    expect(n.options.showIf?.({ showGrid: true })).toBe(true);
    expect(n.options.render).toBeTypeOf('function');
    expect(n.annotations).toEqual({});
  });

  it('schema.defaults() collects every default', () => {
    const s = f.schema({ showGrid: f.boolean(true), cellSize: f.number(20) });
    expect(s.defaults()).toEqual({ showGrid: true, cellSize: 20 });
  });
});

describe('builder / node option collisions', () => {
  // `options` is the node's extras bag AND was briefly an EnumNode method, so
  // section/showIf/render silently vanished on every enum leaf. tsc caught it;
  // this keeps a runtime witness.
  it('every node kind exposes options as the extras bag, not a method', () => {
    const nodes = [
      f.number(1),
      f.boolean(true),
      f.string(''),
      f.color('#fff'),
      f.enum('a', ['a', 'b']),
      f.value(1),
      f.custom('vector2', 0),
    ];
    for (const node of nodes) {
      expect(typeof node.options).toBe('object');
      expect(node.section('S').options.section).toEqual({ label: 'S' });
      expect(node.render(() => null).options.render).toBeTypeOf('function');
    }
  });
});

describe('builder / groups', () => {
  it('f.group nests its children under the key', () => {
    const s = f.schema({
      showGrid: f.boolean(true),
      grid: f.group({ size: f.number(20), color: f.color('#fff') }),
    });
    expect(s.defaults()).toEqual({
      showGrid: true,
      grid: { size: 20, color: '#fff' },
    });
  });

  it('nests groups within groups', () => {
    const s = f.schema({ a: f.group({ b: f.group({ c: f.number(1) }) }) });
    expect(s.defaults()).toEqual({ a: { b: { c: 1 } } });
  });

  it('chains a group label and description immutably', () => {
    const base = f.group({ size: f.number(20) });
    const a = base.label('Grid').describe('How the grid is drawn');
    expect(a.annotations.name).toBe('Grid');
    expect(a.annotations.description).toBe('How the grid is drawn');
    expect(base.annotations.name).toBeUndefined();
  });

  it('holds a group section and showIf off the annotation bag', () => {
    const g = f
      .group({ size: f.number(20) })
      .section('Advanced')
      .showIf((c) => c.showGrid === true);
    expect(g.options.section).toEqual({ label: 'Advanced' });
    expect(g.options.showIf?.({ showGrid: true })).toBe(true);
    expect(g.annotations).toEqual({});
  });
});

describe('builder / nested types', () => {
  // Compile-level: these annotations are the assertion, and tsc is what runs
  // it. A flat `InferConfig` would not give `c.grid.size` a type at all.
  it('infers a nested config type and the paths into it', () => {
    const schema = f.schema({
      showGrid: f.boolean(true),
      grid: f.group({ size: f.number(20), color: f.color('#fff') }),
    });
    type Config = ConfigOf<typeof schema>;
    const c: Config = schema.defaults();
    const size: number = c.grid.size;
    const path: ConfigPath<Config> = 'grid.size';
    const value: ValueAtPath<Config, 'grid.size'> = 40;
    expect([size, path, value]).toEqual([20, 'grid.size', 40]);
  });
});
