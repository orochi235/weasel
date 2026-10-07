/** `single` always replaces; `multi` lets a policy's keys toggle and range. */
export type SelectionMode = 'single' | 'multi';

/** A modifier key a policy can assign to toggling or ranging. */
export type SelectionExtendKey = 'shift' | 'meta' | 'ctrl';

/** The modifiers held during a press. */
export type SelectModifiers = Readonly<Record<SelectionExtendKey, boolean>>;

/** What a press does to the selection. */
export type SelectIntent = 'replace' | 'toggle' | 'range';

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

export interface SelectContext<K> {
  /** The sequence a range walks. A range without one replaces. */
  readonly order?: readonly K[];
  /** Whether an id may join a multi-selection. Ineligible ids are skipped by a range, dropped
   *  when the selection grows, and selected alone when pressed. Default: every id. */
  readonly eligible?: (id: K) => boolean;
}

/** The intent a press carries under `policy`. A range key beats a toggle key. */
export function intentOf(modifiers: SelectModifiers, policy: SelectPolicy): SelectIntent {
  if (policy.mode === 'single') return 'replace';
  if (policy.range && modifiers[policy.range]) return 'range';
  const toggle = typeof policy.toggle === 'string' ? [policy.toggle] : (policy.toggle ?? []);
  return toggle.some((key) => modifiers[key]) ? 'toggle' : 'replace';
}

/** The eligible ids from `from` to `to` in `order`, ends included, in order. Empty when either
 *  end is not in `order`. */
export function rangeOf<K>(order: readonly K[], from: K, to: K, eligible: (id: K) => boolean = always): K[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return [];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1).filter(eligible);
}

/** The selection after pressing `id` with `intent`. Returns `state` itself when nothing changes
 *  hands, so a caller can compare by reference. */
export function select<K>(state: Selection<K>, id: K, intent: SelectIntent, context: SelectContext<K> = {}): Selection<K> {
  const eligible = context.eligible ?? always;
  if (intent === 'toggle' && eligible(id)) {
    const kept = state.ids.filter(eligible);
    return { ids: kept.includes(id) ? kept.filter((x) => x !== id) : [...kept, id], anchor: id };
  }
  if (intent === 'range' && state.anchor !== null && context.order) {
    const { order } = context;
    if (order.includes(state.anchor) && order.includes(id)) {
      const ids = rangeOf(order, state.anchor, id, eligible);
      return ids.length > 0 ? { ids, anchor: state.anchor } : state;
    }
  }
  return { ids: [id], anchor: id };
}

function always(): boolean {
  return true;
}
