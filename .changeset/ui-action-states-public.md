---
'@weasel-js/ui': minor
---

`useActionStates` and `reasonLabel` are public, for chrome built outside `ActionBar` that grays out an action and says why.

`useActionStates(items)` returns each `ActionItem`'s live `ActionState`: whether it can run, whether it is on, and the reason it cannot run. `reasonLabel(reason, labels?)` turns that reason into the words a tooltip shows, from `DEFAULT_REASON_LABELS` unless `labels` says otherwise. All three, and the `ActionState` type, come from `@weasel-js/ui` and `@weasel-js/ui/components/ActionBar`.

<!-- entry: api -->
