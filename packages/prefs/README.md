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

## Scoped prefs

A pref's `scopes` keep its value separately per option of another setting, the
selector, outermost first. A selector is an `enum` pref named by its path, or a
path the schema's root `admits`, whose option the app names as it reads and
writes: a document, a layout from a server. labkit's builder writes the same
with `.per(selector, overrides?)` and `f.schema(…).admits('layout')`.

```ts
'look.mode': { kind: 'enum', default: 'dark', options: [dark, light, types], … }
'limit': { kind: 'number', default: 1.1, scopes: [
  { selector: 'look.mode', overrides: { types: 0 } }, // closed: types has its own value, proposed 0
  { selector: 'layout' },                             // open: a layout has its own value once written
], … }
// on the schema's root: admits: ['layout']

store.get('limit');                                    // the current value, under the selectors' own values
store.get('limit', { at: { layout: 'explorer' } });    // the app names the layout
store.set('limit', 2, { at: { layout: 'explorer' } }); // explorer keeps 2 from now on
store.set('limit', 3);                                 // every other mode and layout reads 3
```

**Closed and open.** A selector given `overrides` is closed: only the options
it names keep a value of their own, and every other option shares one, stored
under `PREF_ELSE` (`$else`). `overrides` is option names, or option → proposed
value. A named option reads its own value once written; before that, its
proposed value if it has one, else the shared value. A selector given no
`overrides` is open: an option reads its own value once one is written for it,
and the shared value until then. With no option named, a selector reads and
writes the shared value.

**The stored value** is a `PrefScope`, `{ $by, $in, $else }`, one per
selector. An option's own value ends there; only the shared value holds the
next selector in:

```ts
{ $by: 'look.mode', $in: { types: 0 }, $else: { $by: 'layout', $in: { explorer: 0.3 }, $else: 1.1 } }
```

Scopes are the declaration's to say: a reader never splits or joins a pref. A
pref with nothing stored holds one empty scope per selector, so its first
write gives the current option a value of its own. An option's own value is
plain, and a write replaces it, unless it is already split by the next
selector in, as a nested `defaultScope` holds it.

A stored value need not have the declared shape, as one stored before the
declaration changed. A plain value reads as the shared value. A value split
by a selector the declaration scopes at that level reads as that scope. A
value split by any other selector reads as it always did, and the first write
to it rebuilds it in the declared shape, with what it reads now as the shared
value, so nothing the reader sees changes but the value written.
A closed list that changes in code needs nothing done: a stored value of an
option no longer named is ignored, and dropped on the pref's next write.

`store.get(path, { weights })` reads the values folded by weight, which is
what a transition between two options shows on the way:

```ts
store.get('limit', { weights: { 'look.mode': { dark: 0.25, light: 0.75 } } });
```

`prefWeightAxes` lays weights out as numbers, the `axes` an `@weasel-js/animator` target takes, so an
animation carries the read from one option to the other. `applyTheme`'s `weights` have the same shape:

```ts
let weights: PrefWeights = { 'look.mode': { dark: 1, light: 0 } };
const target = createTarget({
  get: () => weights,
  set: (next) => { weights = next; },
  axes: prefWeightAxes({ 'look.mode': ['dark', 'light'] }),
  show: (now) => draw(store.get('limit', { weights: now })),
});
animator.tween({ target, to: { 'look.mode': { dark: 0, light: 1 } }, ms: 300 });
```

A number blends linearly and a color blends in OKLCH. Every other kind takes
its heaviest value, the first option on a tie; `blends` in the open options
says otherwise for a kind. `store.values({ at: { 'look.mode': 'light' } })` is
the whole tree as it would read with the selectors set as given.

`store.scopes()` is what every scoped pref holds, by path: one map until
something changes. `usePrefsValues` returns it shaped for `PrefsForm`:

```tsx
const { values, set, scopes, setAt } = usePrefsValues(store);
<PrefsForm schema={schema} values={values} onChange={set}
  scopes={scopes} onChangeAt={setAt} othersLabel="Other modes" />
```

`defaultScope` gives a pref a default that differs by option, where its
selectors' proposed values cannot say it, and `default` stays what reaches
nothing reads:

```ts
'gap': { kind: 'number', default: 4, scopes: [{ selector: 'look.mode' }],
         defaultScope: { $by: 'look.mode', $in: { dark: 4, light: 6 } }, … }
```

A leaf selector must be a plain `enum`: not `clearable`, with no `encoding`,
and not scoped itself. The store warns of a scope that names anything else,
and of one naming a path the schema does not admit, when it opens.

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

## Editing a schema

`@weasel-js/prefs/edit` is the model behind a schema editor, with no React and no DOM: edits to a schema's tree
(`addNode`, `moveNodes`, `renameKey`, `copyNodes`, `aliasNodes`), a leaf's kind and attributes (`changeKind`,
`setAttribute`), printing a schema as source and diffing two (`printSchema`, `diffSchemas`), a `Workspace` of
schema, layout, action, and bundle assets and its `workspaceCodec`, and a condition's rows and its flow as a diagram
(`prefConditionFlow`). `@weasel-js/prefs-editor` draws an editor over it.

