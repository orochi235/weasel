// Short forms for writing a schema by hand. Each returns the plain data a
// literal would: nothing reads a schema differently for how it was written.

import type { PrefAction, PrefActions } from './action';
import type { PrefGroup, PrefSection } from './groups';
import type { PrefLabel, PrefSeparator } from './label';
import type { PrefBoolean, PrefColor, PrefEnumBase, PrefLeaf, PrefNumber, PrefString } from './schema';

/** What a builder takes after the leaf's name and default: any of the leaf's other fields. */
type Rest<L> = Partial<Omit<L, 'kind' | 'name' | 'default'>>;

/** One option of an enum, or its value alone, which is labeled with the value's first letter raised. */

const leaf = <L extends PrefLeaf>(kind: L['kind'], name: string, def: unknown, rest: object | undefined): L =>
  ({ kind, name, description: '', default: def, ...rest }) as L;

const labeled = (value: string): string => (value === '' ? value : value[0]!.toUpperCase() + value.slice(1));

/**
 * Builders for a preferences schema, each returning what the literal would
 * hold. `pref.group('View', { grid: pref.boolean('Grid', true) })` is
 * `{ name: 'View', children: { grid: { kind: 'boolean', name: 'Grid', description: '', default: true } } }`,
 * and its paths and value types are read from it the same way.
 */
export const pref = {
  /** A group: `children` nest under its key, which is a segment of their paths. */
  group<const C extends Record<string, PrefLeaf | PrefGroup>>(
    name: string,
    children: C,
    options?: Omit<PrefGroup, 'name' | 'children'>,
  ): Omit<PrefGroup, 'children'> & { children: C } {
    return { name, ...options, children };
  },

  /** A section: a heading over `members`, whose key adds nothing to their paths. */
  section<const M extends Record<string, PrefLeaf | PrefSection>>(
    name: string,
    members: M,
    options?: Omit<PrefSection, 'name' | 'members'>,
  ): Omit<PrefSection, 'members'> & { members: M } {
    return { name, ...options, members };
  },

  number: (name: string, def: number, rest?: Rest<PrefNumber>): PrefNumber => leaf('number', name, def, rest),
  boolean: (name: string, def: boolean, rest?: Rest<PrefBoolean>): PrefBoolean => leaf('boolean', name, def, rest),
  string: (name: string, def: string, rest?: Rest<PrefString>): PrefString => leaf('string', name, def, rest),
  color: (name: string, def: string, rest?: Rest<PrefColor>): PrefColor => leaf('color', name, def, rest),

  /** A fixed set of choices. An option given as its value alone is labeled with that value, its first letter raised. */
  enum<const T extends string>(
    name: string,
    def: NoInfer<T>,
    options: readonly (T | PrefEnumBase<T>['options'][number])[],
    rest?: Omit<Rest<PrefEnumBase<T>>, 'options'>,
  ): PrefEnumBase<T> & { default: T; clearable?: false } {
    const full = options.map((option) => (typeof option === 'string' ? { value: option, label: labeled(option) } : option));
    return { kind: 'enum', name, description: '', default: def, ...rest, options: full };
  },

  /** A button firing the registered action `action` (`id` or `id:variant`). Its name defaults to empty, which shows the action's own label. */
  action: (action: string, rest?: Partial<Omit<PrefAction, 'kind' | 'default' | 'action'>>): PrefAction =>
    leaf('action', '', undefined, { action, ...rest }),
  /** Every action registered in the action group `group`. */
  actions: (group: string, rest?: Partial<Omit<PrefActions, 'kind' | 'default' | 'group'>>): PrefActions =>
    leaf('actions', '', undefined, { group, ...rest }),
  label: (name: string, rest?: Rest<PrefLabel>): PrefLabel => leaf('label', name, undefined, rest),
  separator: (): PrefSeparator => leaf('separator', '', undefined, undefined),
};
