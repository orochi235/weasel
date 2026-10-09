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

`usePref(store, path)` and `usePrefsValues(store)` bind it to React;
`usePrefsValues` returns exactly what `@weasel-js/ui`'s `PrefsForm` takes.
