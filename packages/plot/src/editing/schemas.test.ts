import { describe, expect, it } from 'vitest';
import { compilePlot, type PlotData, type PlotKind } from '../plotData';
import { PLOT_THEME } from '../theme';
import { plotSchemaOf, plotTablesIn } from './schemas';
import type { PlotColumn, PlotScope, PlotTable, PlotValue } from './schemaTypes';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (data: PlotData) => expect(compilePlot(data, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);

/** One chart of each kind, holding at least one row in every table. */
const SAMPLES: { readonly [K in PlotKind]: Extract<PlotData, { kind: K }> } = {
  pie: { kind: 'pie', slices: [{ label: 'A', value: 2 }, { label: 'B', value: 3 }] },
  xychart: { kind: 'xychart', x: { kind: 'band', categories: ['a', 'b'] }, series: [{ kind: 'bar', values: [1, 2] }] },
  gantt: {
    kind: 'gantt', sections: [{ name: 'S', tasks: [{ name: 'T', id: 't1', start: { kind: 'date', date: '2024-01-01' }, end: { kind: 'duration', amount: 2, unit: 'd' } }] }],
  },
  timeline: { kind: 'timeline', sections: [{ name: 'S', periods: [{ label: '2001', events: ['x'] }] }] },
  quadrant: { kind: 'quadrant', points: [{ name: 'P', x: 0.2, y: 0.3 }], classes: { hot: { color: '#ff0000' } } },
  journey: { kind: 'journey', sections: [{ name: 'S', tasks: [{ name: 'T', score: 3, actors: ['Me'] }] }] },
  gitgraph: { kind: 'gitgraph', commands: [{ kind: 'commit' }, { kind: 'branch', name: 'dev' }, { kind: 'commit' }] },
  sankey: { kind: 'sankey', links: [{ source: 'a', target: 'b', value: 2 }] },
  packet: { kind: 'packet', fields: [{ start: 0, end: 7, label: 'A' }, { start: 8, end: 15, label: 'B' }] },
  radar: { kind: 'radar', axes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], curves: [{ id: 'x', values: [1, 2, 3] }] },
};

/** A value of `column`'s type unlike the one it holds. */
function another(column: PlotColumn, held: PlotValue): PlotValue {
  const t = column.type;
  if (t.kind === 'boolean') return !held;
  if (t.kind === 'number') return t.max !== undefined ? t.max : (typeof held === 'number' ? held : 0) + 1;
  if (t.kind === 'enum') return t.options.find((o) => o !== held);
  if (t.kind === 'color') return '#00ff00';
  return column.key === 'start' || column.key === 'end' ? undefined : `${String(held ?? 'x')}y`.replace(/\s/g, '');
}

describe('plotSchemaOf', () => {
  for (const kind of Object.keys(SAMPLES) as PlotKind[]) {
    const sample = SAMPLES[kind];
    it(`authors a ${kind}: every field and cell set, every table grown, reordered and shrunk, still compiling`, () => {
      const schema = plotSchemaOf(sample);
      let data: PlotData = sample;
      for (const field of schema.fields) {
        if (field.applies?.(data) === false) continue;
        const next = field.set(data, field.type.kind === 'boolean' ? !field.get(data) : field.type.kind === 'enum' ? field.type.options.at(-1) : field.type.kind === 'number' ? 3 : 'Named');
        expect(next.kind).toBe(kind);
        compiles(next);
        data = next;
      }
      for (const { table, scope } of plotTablesIn(schema, data)) data = exercise(table, scope, data);
      compiles(data);
    });
  }

  it('lists a nested table once under each row of its parent', () => {
    const data = SAMPLES.timeline;
    const found = plotTablesIn(plotSchemaOf(data), data).map(({ table, scope }) => `${table.key}:${scope.join('.')}`);
    expect(found).toEqual(['sections:', 'periods:0', 'events:0.0']);
  });
});

/** Every cell of `table` set, a row inserted, moved and removed; each step compiling. */
function exercise(table: PlotTable, scope: PlotScope, start: PlotData): PlotData {
  let data = start;
  const n = table.count(data, scope);
  if (table.insert) {
    data = table.insert(data, scope, n);
    expect(table.count(data, scope)).toBe(n + 1);
    compiles(data);
  }
  for (const column of table.columns(data, scope)) {
    for (let r = 0; r < table.count(data, scope); r++) {
      if (column.readOnly || column.applies?.(data, scope, r) === false) continue;
      const value = another(column, column.get(data, scope, r));
      if (value === undefined) continue;
      data = column.set(data, scope, r, value);
      compiles(data);
    }
  }
  const count = table.count(data, scope);
  if (table.move && count > 1) {
    const row = (d: PlotData, r: number) => table.columns(d, scope).filter((c) => c.key !== 'category' && !c.readOnly && c.key !== 'start').map((c) => c.get(d, scope, r));
    const first = row(data, 0);
    data = table.move(data, scope, 0, count - 1);
    expect(row(data, count - 1)).toEqual(first);
    compiles(data);
  }
  if (table.remove && count > 1) {
    data = table.remove(data, scope, count - 1);
    expect(table.count(data, scope)).toBeLessThan(count);
    compiles(data);
  }
  return data;
}
