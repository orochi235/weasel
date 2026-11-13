import type { PrefGroup } from '@weasel-js/prefs';
import type { Action } from './action';

type Form = NonNullable<Action['params']>;

/** Each merged form's own and added forms, so merging the same form again changes nothing. */
const MERGED = new WeakMap<object, { own: Action['params']; added: Form }>();

function answer(form: Action['params'], params: Readonly<Record<string, unknown>>): PrefGroup | null {
  if (!form) return null;
  return typeof form === 'function' ? form(params) : form;
}

/** `own` and `added` as one form for each run: `added`'s leaves, then `own`'s, an `own` leaf replacing the one
 *  `added` has under its key, named for `own` where it names itself. `null` for a run neither answers. A form
 *  that already holds `added` comes back as it is. */
export function formWith(own: Action['params'], added: Form): Form {
  for (let f: Action['params'] = own; f; f = MERGED.get(f)?.own) {
    if (MERGED.get(f)?.added === added) return own!;
  }
  const merged = (params: Readonly<Record<string, unknown>>): PrefGroup | null => {
    const a = answer(own, params);
    const b = answer(added, params);
    if (!b) return a;
    // `added` may be drawn as a bar where it is declared (a tool's options row); the panel draws it as a form.
    const { as: _bar, ...form } = b;
    return a ? { ...form, ...a, children: { ...form.children, ...a.children } } : form;
  };
  MERGED.set(merged, { own, added });
  return merged;
}
