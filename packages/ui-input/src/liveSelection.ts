import type { SelectionEdit, SelectionModel } from './selection';

/**
 * A run of changes that reports through whichever model `current` gives now, the way a plain click does. A sweep
 * starts at a press and runs across many renders; an edit of the press-time model would report each step through
 * the handler and from the value that render closed over, and a consumer comparing against its own value would
 * rewrite or miss items. Each step continues from what the edit last reported until the component renders a new
 * model, and from what that model holds after. `revert` puts back the states at the start of the run.
 */
function liveEdit(current: () => SelectionModel, count: number): SelectionEdit {
  let model = current();
  let edit = model.edit();
  const initial = new Map<number, boolean>();
  for (let i = 0; i < count; i++) initial.set(i, model.stateOf(i) === 'on');
  const now = (): SelectionEdit => {
    const latest = current();
    if (latest !== model) {
      model = latest;
      edit = latest.edit();
    }
    return edit;
  };
  return {
    set: (i, to) => now().set(i, to),
    apply: (changes) => now().apply(changes),
    revert: () => now().apply(initial),
  };
}

/** The selection model `current` gives at each call, so an edit begun at a press reports through the component's
 *  latest handler and value: a sweep's model. `count` is how many items the model has. */
export function liveSelection(current: () => SelectionModel, count: () => number): SelectionModel {
  return {
    get mode() { return current().mode; },
    get followsFocus() { return current().followsFocus; },
    stateOf: (i) => current().stateOf(i),
    press: (i) => current().press(i),
    edit: () => liveEdit(current, count()),
  };
}
