/**
 * Selection: which of a run of items are on. One spec answers what each item
 * shows, what a click on it does, what the arrow keys do, and how a sweep
 * sets several at once, so a component taking it cannot get one of them
 * wrong. Build a model with {@link selection} (one value, or a list of them)
 * or {@link selectionOfEach} (items that each own a boolean); {@link selectionKeys}
 * says what the keyboard does with it.
 */

/** An item's state: on, off, or mixed, where the sources it aggregates disagree. */
export type SelectState = 'off' | 'on' | 'mixed';

/** At most one item on, held as its value or `null`. */
export interface SingleSelection<V> {
  mode?: 'single';
  value: V | null;
  onChange: (next: V | null) => void;
  /** A click on the item that is on turns it off. Default false. */
  allowDeselect?: boolean;
  /** Values drawn mixed, where `value` holds none of them. A click on one chooses it. */
  mixedValues?: readonly V[];
  /** The arrow keys choose the item they land on, as a radio group's do. Default true; false moves focus only,
   *  and Space or Enter chooses. */
  followsFocus?: boolean;
}

/** Any number of items on, held as a list of their values. */
export interface MultipleSelection<V> {
  mode: 'multiple';
  value: readonly V[];
  onChange: (next: V[]) => void;
  /**
   * Values that are neither on nor off: the sources this aggregates disagree (a text range bold in part of it, a
   * multi-selection whose nodes differ). `value` wins where the two lists overlap. A click on one turns it on.
   */
  mixedValues?: readonly V[];
}

/** One spec for a run of items whose selection is one value or a list of them. */
export type SelectionSpec<V> = SingleSelection<V> | MultipleSelection<V>;

/** One item that owns its own on/off state. */
export interface OwnSelection {
  selected: boolean;
  onChange: (next: boolean) => void;
}

/** A run of changes to a selection, each from where the last left it: a sweep's. */
export interface SelectionEdit {
  /** Set item `index` on or off. */
  set(index: number, on: boolean): void;
  /** Put back what the edit started from. */
  revert(): void;
}

/** A selection over items by index. */
export interface SelectionModel {
  /** At most one item on, or any number. */
  readonly mode: 'single' | 'multiple';
  stateOf(index: number): SelectState;
  /** What a click on item `index` does: choose it, or flip it. */
  press(index: number): void;
  /** Start a run of changes. Each `set` reports as it happens, from the edit's own copy, so a run faster than
   *  the component re-renders loses none of them. */
  edit(): SelectionEdit;
  /** The arrow keys choose as they move. */
  readonly followsFocus: boolean;
}

/** Whether `a` and `b` are one value as `Array.prototype.includes` reads them: `NaN` is itself, `-0` is `0`. */
const same = (a: unknown, b: unknown): boolean => a === b || (Number.isNaN(a) && Number.isNaN(b));

/** `spec`'s selection over `values`, one per item in order. */
export function selection<V>(spec: SelectionSpec<V>, values: readonly V[]): SelectionModel {
  const mixed = spec.mixedValues ?? [];
  if (spec.mode === 'multiple') {
    const on = spec.value;
    const flip = (list: readonly V[], v: V, to: boolean): V[] => (to ? [...list, v] : list.filter((w) => !same(w, v)));
    return {
      mode: 'multiple',
      followsFocus: false,
      stateOf: (i) => (on.includes(values[i]!) ? 'on' : mixed.includes(values[i]!) ? 'mixed' : 'off'),
      press: (i) => spec.onChange(flip(on, values[i]!, !on.includes(values[i]!))),
      edit: () => {
        const initial = on;
        let working: readonly V[] = initial;
        return {
          set: (i, to) => {
            const v = values[i]!;
            if (working.includes(v) === to) return;
            const next = flip(working, v, to);
            working = next;
            spec.onChange(next);
          },
          revert: () => { if (working !== initial) spec.onChange([...initial]); },
        };
      },
    };
  }
  const choose = (next: V | null): void => spec.onChange(next);
  return {
    mode: 'single',
    followsFocus: spec.followsFocus ?? true,
    stateOf: (i) => (same(spec.value, values[i]) ? 'on' : mixed.includes(values[i]!) ? 'mixed' : 'off'),
    press: (i) => {
      if (!same(spec.value, values[i])) choose(values[i]!);
      else if (spec.allowDeselect) choose(null);
    },
    edit: () => {
      const initial = spec.value;
      let working = initial;
      return {
        set: (i, to) => {
          const next = to ? values[i]! : same(working, values[i]) && spec.allowDeselect ? null : working;
          if (same(next, working)) return;
          working = next;
          choose(next);
        },
        revert: () => { if (!same(working, initial)) choose(initial); },
      };
    },
  };
}

/** The selection of items that each own their state: any number on, and nothing mixed. */
export function selectionOfEach(items: readonly OwnSelection[]): SelectionModel {
  return {
    mode: 'multiple',
    followsFocus: false,
    stateOf: (i) => (items[i]!.selected ? 'on' : 'off'),
    press: (i) => items[i]!.onChange(!items[i]!.selected),
    edit: () => {
      const initial = items.map((it) => it.selected);
      const working = [...initial];
      return {
        set: (i, to) => {
          if (working[i] === to) return;
          working[i] = to;
          items[i]!.onChange(to);
        },
        revert: () => {
          working.forEach((to, i) => {
            if (to === initial[i]) return;
            working[i] = initial[i]!;
            items[i]!.onChange(initial[i]!);
          });
        },
      };
    },
  };
}

/** A sweep over `model` from a press on item `from`: each item it `reach`es is set to the opposite of whether the
 *  pressed one was on, so a drag from an off or mixed item turns on everything it crosses and one from an on item
 *  turns it off. `revert` puts back what the sweep started from. */
export function sweepFrom(model: SelectionModel, from: number): { reach(index: number): void; revert(): void } {
  const to = model.stateOf(from) !== 'on';
  const edit = model.edit();
  return { reach: (i) => edit.set(i, to), revert: () => edit.revert() };
}

/** What the keyboard does with `model`'s items. Where a single selection follows focus, the tab stop sits on the
 *  chosen item and an arrow landing on one chooses it; otherwise the arrows only move focus, and Space or Enter
 *  presses. `enabled(i)` is false for an item nothing may choose. */
export function selectionKeys(
  model: SelectionModel,
  count: number,
  enabled: (index: number) => boolean = () => true,
): { tabStop?: number; landed?: (index: number) => void; activate?: (index: number) => void } {
  if (model.mode === 'single' && model.followsFocus) {
    let chosen = -1;
    for (let i = 0; i < count && chosen < 0; i++) if (model.stateOf(i) === 'on') chosen = i;
    return { tabStop: chosen >= 0 ? chosen : undefined, landed: (i) => { if (enabled(i)) model.edit().set(i, true); } };
  }
  return { activate: (i) => { if (enabled(i)) model.press(i); } };
}
