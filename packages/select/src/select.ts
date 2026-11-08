/** `single` always replaces; `multi` lets a policy's keys toggle and range. */
export type SelectionMode = 'single' | 'multi';

/** A modifier key a policy can assign to toggling or ranging. */
export type SelectionExtendKey = 'shift' | 'meta' | 'ctrl';

/** The modifiers held during a press. */
export type SelectModifiers = Readonly<Record<SelectionExtendKey, boolean>>;

/** What a press does to the selection. `single` selects the pressed id alone, as a press on an id
 *  `forceSingle` holds does under any intent. */
export type SelectIntent = 'replace' | 'toggle' | 'range' | 'single';

/** Which keys toggle and which range, so a surface states its convention: a list usually
 *  toggles on Cmd/Ctrl and ranges on shift, a canvas toggles on shift. */
export interface SelectPolicy {
  readonly mode: SelectionMode;
  readonly toggle?: SelectionExtendKey | readonly SelectionExtendKey[];
  readonly range?: SelectionExtendKey;
}

/** What is selected, and the end a range extends from. */
export interface Selection<K> {
  readonly ids: readonly K[];
  readonly anchor: K | null;
}

/** What a press is resolved against besides the selection: the order a range walks, and which ids are selected only alone. */
export interface SelectContext<K> {
  /** The sequence a range walks. A range without one replaces. */
  readonly order?: readonly K[];
  /** Whether an id is selected only alone, a locked layer for one. A press on it is a `single` press
   *  whatever its modifiers; a range walking past it skips it, and a toggle drops it. Default: none. */
  readonly forceSingle?: (id: K) => boolean;
}

/** The intent a press carries under `policy`. A range key beats a toggle key. */
export function intentOf(modifiers: SelectModifiers, policy: SelectPolicy): SelectIntent {
  if (policy.mode === 'single') return 'replace';
  if (policy.range && modifiers[policy.range]) return 'range';
  const toggle = typeof policy.toggle === 'string' ? [policy.toggle] : (policy.toggle ?? []);
  return toggle.some((key) => modifiers[key]) ? 'toggle' : 'replace';
}

/** The ids from `from` to `to` in `order`, ends included, in order, less those `forceSingle` holds.
 *  Empty when either end is not in `order`. */
export function rangeOf<K>(order: readonly K[], from: K, to: K, forceSingle: (id: K) => boolean = never): K[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return [];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1).filter((id) => !forceSingle(id));
}

/** The selection after pressing `id` with `intent`. Returns `state` itself when nothing changes
 *  hands, so a caller can compare by reference. */
export function select<K>(state: Selection<K>, id: K, intent: SelectIntent, context: SelectContext<K> = {}): Selection<K> {
  const forceSingle = context.forceSingle ?? never;
  if (forceSingle(id)) intent = 'single';
  if (intent === 'toggle') {
    const kept = state.ids.filter((x) => !forceSingle(x));
    return { ids: kept.includes(id) ? kept.filter((x) => x !== id) : [...kept, id], anchor: id };
  }
  if (intent === 'range' && state.anchor !== null && context.order) {
    const { order } = context;
    if (order.includes(state.anchor) && order.includes(id)) {
      return settle(state, { ids: rangeOf(order, state.anchor, id, forceSingle), anchor: state.anchor });
    }
  }
  return settle(state, { ids: [id], anchor: id });
}

function settle<K>(state: Selection<K>, next: Selection<K>): Selection<K> {
  const same = next.anchor === state.anchor
    && next.ids.length === state.ids.length
    && next.ids.every((id, i) => id === state.ids[i]);
  return same ? state : next;
}

function never(): boolean {
  return false;
}
