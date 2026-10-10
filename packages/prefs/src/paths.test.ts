import { describe, expectTypeOf, it } from 'vitest';
import type { PrefAtPath, PrefPath, PrefValueAt } from './paths';
import type { PrefGroup } from './groups';

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
    clear: {
      kind: 'enum',
      name: 'Clear',
      description: '',
      default: 'a',
      clearable: true,
      options: [{ value: 'a', label: 'A' }],
    },
    paint: { kind: 'paint', name: 'Paint', description: '', default: '#000' },
    box: {
      kind: 'object',
      name: 'Box',
      description: '',
      default: {},
      children: { w: { kind: 'number', name: 'W', description: '', default: 0 } },
    },
    custom: { kind: 'registry-enum', name: 'Custom', description: '', default: 'select' as string },
  },
} satisfies PrefGroup;
type Schema = typeof _schema;

describe('PrefPath', () => {
  it('names every leaf by its dotted path, group keys included', () => {
    expectTypeOf<PrefPath<Schema>>().toEqualTypeOf<
      'loose' | 'view.density' | 'view.grid.color' | 'fill' | 'clear' | 'paint' | 'box' | 'custom'
    >();
  });

  it('degrades to string on a schema widened to PrefGroup', () => {
    expectTypeOf<PrefPath<PrefGroup>>().toEqualTypeOf<string>();
  });

  it('keeps the prefix on a nested group widened to PrefGroup', () => {
    type Partly = {
      name: 'r';
      children: { tools: PrefGroup; a: { kind: 'boolean'; name: 'A'; description: ''; default: true } };
    };
    expectTypeOf<PrefPath<Partly>>().toEqualTypeOf<'a' | `tools.${string}`>();
  });

  it('includes an object leaf but not its fields', () => {
    expectTypeOf<Extract<PrefPath<Schema>, 'box' | 'box.w'>>().toEqualTypeOf<'box'>();
  });
});

describe('PrefAtPath', () => {
  it('finds the leaf at a nested path', () => {
    expectTypeOf<PrefAtPath<Schema, 'view.grid.color'>['kind']>().toEqualTypeOf<'color'>();
  });

  it('does not descend into an object leaf', () => {
    expectTypeOf<PrefAtPath<Schema, 'box.w'>>().toBeNever();
  });
});

describe('PrefValueAt', () => {
  it('types built-in kinds by kind and app-defined kinds by their default', () => {
    expectTypeOf<PrefValueAt<Schema, 'loose'>>().toEqualTypeOf<boolean>();
    expectTypeOf<PrefValueAt<Schema, 'view.density'>>().toEqualTypeOf<number>();
    expectTypeOf<PrefValueAt<Schema, 'view.grid.color'>>().toEqualTypeOf<string>();
    expectTypeOf<PrefValueAt<Schema, 'custom'>>().toEqualTypeOf<string>();
    expectTypeOf<PrefValueAt<Schema, 'fill'>>().toEqualTypeOf<string>();
  });

  it('adds undefined for a clearable enum and leaves a paint open', () => {
    expectTypeOf<PrefValueAt<Schema, 'clear'>>().toEqualTypeOf<string | undefined>();
    expectTypeOf<PrefValueAt<Schema, 'paint'>>().toEqualTypeOf<unknown>();
  });
});
