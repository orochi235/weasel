import { continuing, type SelectionEdit, type SelectionModel } from './selection';

/**
 * A run of changes that reports through whichever model `current` gives now, the way a plain click does. A sweep
 * starts at a press and runs across many renders; an edit of the press-time model would report each step through
 * the handler and from the value that render closed over, and a consumer comparing against its own value would
 * rewrite or miss items. Each step continues from what the edit last reported until the component renders a new
 * model, and from what that model holds after. `revert` puts back the value the run started from.
 */
function liveEdit(current: () => SelectionModel, from: SelectionEdit | undefined): SelectionEdit {
  let model = current();
  const first = model.edit(from);
  let edit = first;
  const now = (): SelectionEdit => {
    const latest = current();
    if (latest !== model) {
      model = latest;
      edit = latest.edit(first);
    }
    return edit;
  };
  return continuing({
    set: (i, to) => now().set(i, to),
    apply: (changes) => now().apply(changes),
    revert: () => now().revert(),
  }, first);
}

/** The selection model `current` gives at each call, so an edit begun at a press reports through the component's
 *  latest handler and value: a sweep's model. The second argument, once the item count, is no longer read. */
export function createLiveSelectionModel(current: () => SelectionModel, _count?: () => number): SelectionModel {
  return {
    get mode() { return current().mode; },
    get followsFocus() { return current().followsFocus; },
    stateOf: (i) => current().stateOf(i),
    press: (i) => current().press(i),
    edit: (from) => liveEdit(current, from),
  };
}
