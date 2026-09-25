import type { TokenScaleRule } from '@weasel-js/labkit';
import { isByAxis, type AxisDefs, type Selection, type ThemeDefinition } from '@weasel-js/theme';
import type { Globals } from '../../protocol/messages';

/** A scale as the panel left it: what a save writes into the definition. */
export interface ScaleEdit {
  readonly base: number;
  readonly rule: TokenScaleRule;
}

export type ScaleEditResult =
  | { readonly ok: true; readonly definition: ThemeDefinition }
  | { readonly ok: false; readonly message: string };

type Holder = Record<string | number, unknown>;

interface Slot {
  readonly holder: Holder;
  readonly key: string | number;
  /** Where the slot is, for a message: `scales.font-size.base`, `seeds.ui-base.compact`. */
  readonly where: string;
}

const SEED_REF = /^\{seeds\.([^}]+)\}$/;
const RULE_KEYS = { factors: 'factors', ratio: 'ratio', step: 'step' } as const;

/**
 * The axis values a trial renders under, from the workshop's globals: a global named for an axis picks its value; an
 * axis no global names renders at its default. A global holding something the axis does not offer (`mode: 'auto'`)
 * leaves that axis out, because which value it resolved to is not known here.
 */
export function selectionFor(axes: AxisDefs, globals: Globals): Selection {
  const out: Record<string, string> = {};
  for (const [axis, def] of Object.entries(axes)) {
    const value = globals[axis];
    if (value === undefined) out[axis] = def.default;
    else if (typeof value === 'string' && value in def.values) out[axis] = value;
  }
  return out;
}

class EditError extends Error {}

/** Follows a param through its per-axis branches and `{seeds.name}` references to the number that defines it. */
function slotOf(root: ThemeDefinition, holder: Holder, key: string | number, where: string, selection: Selection, depth = 0): Slot {
  if (depth > 16) throw new EditError(`${where} references itself`);
  let h = holder;
  let k = key;
  let w = where;
  let value = h[k];
  while (isByAxis(value)) {
    const axis = value.by;
    const picked = selection[axis];
    if (picked === undefined || picked === 'by' || !(picked in value)) {
      throw new EditError(`${w} differs by ${axis}, and which ${axis} this trial shows is not known`);
    }
    h = value as unknown as Holder;
    k = picked;
    w = `${w}.${picked}`;
    value = h[k];
  }
  if (typeof value === 'number') return { holder: h, key: k, where: w };
  if (typeof value === 'string') {
    const ref = SEED_REF.exec(value);
    if (!ref) throw new EditError(`${w} is "${value}", which is not a number or a seed`);
    const name = ref[1]!;
    const seeds = root.seeds as Holder | undefined;
    if (!seeds || !(name in seeds)) throw new EditError(`${w} names the seed "${name}", which this theme inherits rather than defines`);
    return slotOf(root, seeds, name, `seeds.${name}`, selection, depth + 1);
  }
  throw new EditError(`${w} is not a number`);
}

/** The factor list the selection reads, through any per-axis branches. */
function factorsOf(holder: Holder, where: string, selection: Selection): { list: Holder; where: string } {
  let value = holder.factors;
  let w = `${where}.factors`;
  while (isByAxis(value)) {
    const picked = selection[value.by];
    if (picked === undefined || !(picked in value)) {
      throw new EditError(`${w} differs by ${value.by}, and which ${value.by} this trial shows is not known`);
    }
    w = `${w}.${picked}`;
    value = (value as unknown as Holder)[picked];
  }
  if (!Array.isArray(value)) throw new EditError(`${w} is not a list`);
  return { list: value as unknown as Holder, where: w };
}

const kindOf = (scale: Holder): TokenScaleRule['kind'] | null =>
  scale.factors !== undefined ? 'factors' : scale.ratio !== undefined ? 'ratio' : scale.step !== undefined ? 'step' : null;

const plainLiteral = (value: unknown): boolean =>
  typeof value === 'number' || (Array.isArray(value) && value.every((v) => typeof v === 'number'));

/** Swaps `scale`'s rule key for another in place, in the same position, since record order is emission order. */
function swapRule(scale: Holder, from: string | null, to: string, value: unknown): void {
  const entries = Object.entries(scale);
  for (const [k] of entries) delete scale[k];
  for (const [k, v] of entries) scale[k === from ? to : k] = k === from ? value : v;
  if (from === null) scale[to] = value;
}

/**
 * `definition` with each edited scale written back. A number the scale reads through a reference or a per-axis branch
 * is written where it lives — `{seeds.ui-base}` changes the seed, and only the branch for `selection` — so every other
 * axis value keeps its own. Changing a scale's rule kind replaces the rule, which is refused when the old one was
 * anything but a plain literal, since that would flatten it.
 */
export function applyScaleEdits(
  definition: ThemeDefinition,
  edits: Readonly<Record<string, ScaleEdit>>,
  selection: Selection,
): ScaleEditResult {
  const root = structuredClone(definition) as ThemeDefinition & { scales?: Record<string, Holder> };
  const writes = new Map<Holder, Map<string | number, number>>();
  const write = (slot: Slot, value: number) => {
    let byKey = writes.get(slot.holder);
    if (!byKey) writes.set(slot.holder, (byKey = new Map()));
    const pending = byKey.get(slot.key);
    if (pending !== undefined && pending !== value) throw new EditError(`${slot.where} would need to be both ${pending} and ${value}`);
    byKey.set(slot.key, value);
  };

  try {
    for (const [name, edit] of Object.entries(edits)) {
      const scales = root.scales;
      const scale = scales?.[name];
      if (!scales || !scale) throw new EditError(`the theme defines no scale "${name}"`);
      const where = `scales.${name}`;
      write(slotOf(root, scale, 'base', `${where}.base`, selection), edit.base);

      const { rule } = edit;
      const had = kindOf(scale);
      if (had !== rule.kind) {
        const from = had ? RULE_KEYS[had] : null;
        if (from && !plainLiteral(scale[from])) {
          throw new EditError(`${where} would lose its ${from} to become a ${rule.kind} scale, and its ${from} is not a plain number`);
        }
        const value = rule.kind === 'factors' ? [...rule.factors] : rule.kind === 'ratio' ? rule.ratio : rule.step;
        swapRule(scale, from, RULE_KEYS[rule.kind], value);
        continue;
      }
      if (rule.kind === 'factors') {
        const { list, where: at } = factorsOf(scale, where, selection);
        if ((list as unknown as unknown[]).length !== rule.factors.length) {
          throw new EditError(`${at} has ${(list as unknown as unknown[]).length} factors, and the edit ${rule.factors.length}`);
        }
        rule.factors.forEach((factor, i) => write(slotOf(root, list, i, `${at}.${i}`, selection), factor));
      } else {
        const key = RULE_KEYS[rule.kind];
        write(slotOf(root, scale, key, `${where}.${key}`, selection), rule.kind === 'ratio' ? rule.ratio : rule.step);
      }
    }
  } catch (e) {
    if (e instanceof EditError) return { ok: false, message: `Cannot save: ${e.message}.` };
    throw e;
  }

  for (const [holder, byKey] of writes) for (const [key, value] of byKey) holder[key] = value;
  return { ok: true, definition: root };
}
