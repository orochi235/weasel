import { describe, expectTypeOf, it } from 'vitest';
import type { PrefAtPath, PrefPath, PrefValueAt } from './paths';
import type { PrefGroup } from './schema';

const _schema = {
  name: 'Test',
  children: {
    loose: { kind: 'boolean', name: 'Loose', description: '', default: true },
    view: {
      name: 'View',
      children: {
        density: { kind: 'number', name: 'Density', description: '', default: 72, min: 4, max: 288 },
        grid: {
          name: 'Grid',
          children: {
            color: { kind: 'color', name: 'Color', description: '', default: '#ccc' },
          },
        },
      },
    },
    fill: {
      kind: 'enum',
      name: 'Fill',
      description: '',
      default: 'nonzero',
      options: [
        { value: 'nonzero', label: 'Nonzero' },
        { value: 'evenodd', label: 'Even-odd' },
      ],
    },
    custom: { kind: 'registry-enum', name: 'Custom', description: '', default: 'select' as string },
  },
} satisfies PrefGroup;
type Schema = typeof _schema;

describe('PrefPath', () => {
  it('names every leaf by its dotted path, group keys included', () => {
    expectTypeOf<PrefPath<Schema>>().toEqualTypeOf<
      'loose' | 'view.density' | 'view.grid.color' | 'fill' | 'custom'
    >();
  });
});

describe('PrefAtPath', () => {
  it('finds the leaf at a nested path', () => {
    expectTypeOf<PrefAtPath<Schema, 'view.grid.color'>['kind']>().toEqualTypeOf<'color'>();
  });
});

describe('PrefValueAt', () => {
  it('types built-in kinds by kind and app-defined kinds by their default', () => {
    expectTypeOf<PrefValueAt<Schema, 'loose'>>().toEqualTypeOf<boolean>();
    expectTypeOf<PrefValueAt<Schema, 'view.density'>>().toEqualTypeOf<number>();
    expectTypeOf<PrefValueAt<Schema, 'view.grid.color'>>().toEqualTypeOf<string>();
    expectTypeOf<PrefValueAt<Schema, 'custom'>>().toEqualTypeOf<string>();
    expectTypeOf<PrefValueAt<Schema, 'fill'>>().toMatchTypeOf<string>();
  });
});
