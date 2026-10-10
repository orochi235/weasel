# @weasel-js/prefs

A preferences schema — groups of typed leaves with names, defaults and
rendering hints — and a store that keeps values for it.

```ts
const store = await openPrefs(SCHEMA, { storage: indexedDbAdapter, prefix: 'myapp.prefs.' });
store.get('view.gridVisible');
store.set('view.gridVisible', false);
```

One record per leaf. A leaf with no record follows its schema default. Reads
repair stored values that no longer fit the schema without writing them back.
`migrations[i]` takes stored records from version `i` to `i + 1`.
`openPrefsSync` opens from an adapter that reads synchronously, such as
`localStorageAdapter`, with no `await`.

`usePref(store, path)` and `usePrefsValues(store)` bind it to React. They
live in `@weasel-js/prefs/react`, so the main entry never loads React.
`usePrefsValues` returns the pieces `@weasel-js/ui`'s `PrefsForm` takes.

## Ranges

A number leaf's range is one scale: the low end is the least of what its label
names and the high end the most. Do not give zero a second meaning such as
"no limit" or "automatic" — on a slider it reads as the least, and the form
draws it there. Put an unlimited setting at the end of the range it is nearest:
a 0–100% limit is off at 100, and a scale with no such end takes `endless`,
which adds a stop one step past the range that stores `Infinity` and reads the
leaf's `infinity` word.
