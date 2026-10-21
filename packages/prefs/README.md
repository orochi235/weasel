# @weasel-js/prefs

A preferences schema — groups of typed leaves with names, defaults and
rendering hints — and a store that keeps values for it.

```ts
const store = await openPrefs(SCHEMA, { storage: indexedDbAdapter, prefix: 'myapp.prefs.' });
store.get('view.gridVisible');
store.set('view.gridVisible', false);
```

A schema is plain data, and `pref` writes it shorter:

```ts
const SCHEMA = pref.group('Prefs', {
  view: pref.group('View', {
    gridVisible: pref.boolean('Grid', true),
    gridGap: pref.number('Grid gap', 8, { min: 2, max: 64, unit: { scale: 1, suffix: 'px' } }),
    mode: pref.enum('Mode', 'dark', ['dark', 'light']),
  }),
});
```

Each builder returns what the literal would hold (`{ name, children }` for a
group, `{ kind, name, description, default, … }` for a leaf), so paths and
value types are read from it the same way, and the two can be mixed.

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

## Tags

A leaf, a group, and a section can each carry `tags`: words a settings search
also finds it by, and that gather it with others. A leaf carries its own and
every group's above it, so tagging a group tags all it holds:

```ts
canvas: { name: 'Canvas', tags: ['workspace'], children: {
  grid: { kind: 'boolean', name: 'Show grid', description: '', default: true, tags: ['guides'] },
} },

prefLeavesTagged(SCHEMA, 'guides');      // Map { 'canvas.grid' => … }
prefLeafTags(SCHEMA, 'canvas.grid');     // ['workspace', 'guides']
filterPrefSubtree(SCHEMA, 'guide');      // keeps canvas.grid, matched by its tag
```

A search matches a tag as it matches a name, and a group a tag matches keeps
all its leaves, as one its name matches does. An alias carries its target's
tags and its own. `tags` is unrelated to a `union` leaf's `tag`, the field its
value's variant is read from.

## Ranges

A number leaf's range is one scale: the low end is the least of what its label
names and the high end the most. Do not give zero a second meaning such as
"no limit" or "automatic" — on a slider it reads as the least, and the form
draws it there. Put an unlimited setting at the end of the range it is nearest:
a 0–100% limit is off at 100, and a scale with no such end takes `endless`,
which adds a stop one step past the range that stores `Infinity` and reads the
leaf's `infinity` word.

A bound that depends on where the value is held takes `minAt` or `maxAt`: a
function handed a reader of the values beside it, by the paths a condition
there would name, returning the bound or `undefined`. It is taken with `min`
or `max`, the tighter winning, and `prefNumberAt(leaf, read)` folds it in for
one holder. A box's width that may not go under its node's own minimum reads
`data.minSize` this way: `SelectionPanel` resolves it against each node and
holds each write to that node's bound, and `PrefsForm` and labkit's
`ControlPanel` resolve it against their values.

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

A leaf's default may be split too. `defaultLocus` is what the leaf holds while
nothing is stored for it, and `default` stays what a member it leaves out
reads as:

```ts
'gap': { kind: 'number', default: 4, splitBy: ['look.mode'],
         defaultLocus: { $by: 'look.mode', $of: { dark: 4, light: 6 } }, … }

store.get('gap');                                    // 4, or 6 once the mode is light
store.set('gap', 8, { at: { 'look.mode': 'light' } }); // holds { dark: 4, light: 8 }
store.reset('gap');                                  // the split default again
```

A selector must be a plain `enum`: not `clearable`, with no `encoding`, and
not split itself. The store warns of a `splitBy` that names anything else when
it opens.

## As CSS custom properties

`prefsCss(store)` writes the store's values as custom properties, and
`prefsCssAttributes(store)` gives the attributes that pick its blocks:

```css
:where(:root) {
  --look-mode: dark;
  --gap: 4px;          /* a split value, at the member the selectors' defaults name */
}

:where(:root[data-look-mode='light']) {
  --look-mode: light;
  --gap: 6px;
}
```

Every leaf is set on the root. A block follows for each choice of options a
split value tells apart, and only those: a value that is one thing under
`light` at every density gets one block for `light`. Every block is inside
`:where()`, so a rule of the page's own wins, and blocks naming more selectors
come later. A number is written in its display unit where the unit's suffix is
a CSS unit, a boolean as `1` or `0`, an enum's option as an identifier, and a
string quoted; a leaf of any other kind is left out unless the `value` option
writes it. `root`, `property`, and `attribute` rename what it writes.

`prefsDefaultsSource(schema)` stands in for a store at its defaults, so
`prefsCss(prefsDefaultsSource(schema))` is a schema's stylesheet with no store.
The Vite plugin in `@weasel-js/prefs/vite` serves that sheet for every schema
you name, by module and export, and rewrites it when a schema changes:

```ts
// vite.config.ts
import { weaselPrefsCss } from '@weasel-js/prefs/vite';
export default { plugins: [weaselPrefsCss({ schemas: { './src/prefs.ts': 'SCHEMA' } })] };

// main.ts
import 'virtual:weasel-prefs.css';
```

For the kit's own settings, `<KitSettingsFromPrefs store at="kit">` in
`@weasel-js/prefs/react` hands the store's values under `kit` to
`KitSettingsProvider`, so `useKitSetting('tree.typeaheadMs')` reads the user's
value. With `css`, it also writes that subtree as `--wzl-kit-*` properties into
the document or shadow root it renders in, and keeps them current as the store
changes; `kitSettingsCssOptions(at)` is the naming it uses.
