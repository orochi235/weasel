# @weasel-js/prefs-schema

The declaration half of [`@weasel-js/prefs`](../prefs/README.md): the `pref`
builders, the leaf, group and section types, units, conditions and the status
they give a leaf, and repairing a stored value against a leaf. No store, no
storage, no React.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/prefs-schema).

```sh
npm install @weasel-js/prefs-schema
```

```ts
import { pref, type PrefGroup } from '@weasel-js/prefs-schema';

const params: PrefGroup = pref.group('Offset', {
  distance: pref.number('Distance', 4, { min: 0, unit: { scale: 1, suffix: 'px' } }),
});
```

A package that declares settings and leaves storing them to its host (an
action's `params`, a tool's options, a node's properties) depends on this one.
`@weasel-js/prefs` re-exports all of it beside the store, so an app that opens
a store imports from there and never needs this package by name.

- `@weasel-js/prefs-schema/internal` — not public API. The helpers
  `@weasel-js/prefs` builds its store and edit model on; it changes without
  notice.
