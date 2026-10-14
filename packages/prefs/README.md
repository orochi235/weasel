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

`usePrefsStore(schema, { storage, prefix })` gives a component a store of its
own: open from its first render, closed with its writes sent when it unmounts.
It takes an adapter that reads synchronously, and components naming the same
`storage`, `prefix`, and `schema` share one store. Components naming one
`storage` and `prefix` with different schemas each get a store over the same
records.

## Ranges

A number leaf's range is one scale: the low end is the least of what its label
names and the high end the most. Do not give zero a second meaning such as
"no limit" or "automatic" — on a slider it reads as the least, and the form
draws it there. Put an unlimited setting at the end of the range it is nearest:
a 0–100% limit is off at 100, and a scale with no such end takes `endless`,
which adds a stop one step past the range that stores `Infinity` and reads the
leaf's `infinity` word.

## Split values

A leaf that lists `splitBy` may hold its value once per option of another
leaf, where it would hold one. The other leaf, the selector, is an ordinary
`enum` named by its path:

```ts
'look.mode': { kind: 'enum', default: 'dark', options: [dark, light], … }
'gap':       { kind: 'number', default: 4, splitBy: ['look.mode'], … }

store.split('gap', 'look.mode');   // holds { $by: 'look.mode', $of: { dark: 4, light: 4 } }
store.set('gap', 8);               // writes the member the mode is set to
store.set('look.mode', 'light');   // a change to every leaf split by it
store.join('gap', 'look.mode');    // back to one value: the member the mode is set to
```

The stored value is a locus, `{ $by, $of }`, and a member may itself be split
by a second selector. `store.get` reads the member the selectors are set to.
`store.get(path, { weights })` reads the alternatives folded by weight, which
is what a transition between two options shows on the way:

```ts
store.get('gap', { weights: { 'look.mode': { dark: 0.25, light: 0.75 } } });
```

A number blends linearly and a color blends in OKLCH. Every other kind takes
its heaviest alternative, the first option on a tie; `blends` in the open
options says otherwise for a kind. `store.values({ at: { 'look.mode': 'light' } })`
is the whole tree as it would read with the selectors set as given.

`store.set(path, value, { at })` writes the member a stated choice names,
whatever the selectors are set to, and `store.loci()` is what every split leaf
holds, by path: one map until something changes. `usePrefsValues` returns
both shaped for `PrefsForm`, with `split` and `join` beside them:

```tsx
const { values, set, loci, split, join, setAt } = usePrefsValues(store);
<PrefsForm schema={schema} values={values} onChange={set}
  loci={loci} onSplit={split} onJoin={join} onChangeAt={setAt} />
```

A selector must be a plain `enum`: not `clearable`, with no `encoding`, and
not split itself. The store warns of a `splitBy` that names anything else when
it opens.
