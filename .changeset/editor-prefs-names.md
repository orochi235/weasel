---
'@weasel-js/editor': major
---

The editor's preferences exports say `Prefs`: `EDITOR_PREFS_KEY` and `useOpenPrefs`.

They were `EDITOR_PREFERENCES_KEY` and `useOpenPreferences`; `Prefs` is the kit's spelling everywhere else.

```ts
// before
useCommand(EDITOR_ACTIONS.preferences, label, open, { keys: EDITOR_PREFERENCES_KEY });
const openPrefs = useOpenPreferences();
// after
useCommand(EDITOR_ACTIONS.preferences, label, open, { keys: EDITOR_PREFS_KEY });
const openPrefs = useOpenPrefs();
```

<!-- entry: breaking api -->
