---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A pref leaf says whether and how it can be auto in one field, `auto`, in place of `manual`, `unpinned` and `autoValue`, which are gone. This changes the schema shape: a schema that sets any of the three must be rewritten.

| Before | After |
|---|---|
| none of the three | `auto` left out: the leaf can be auto, and starts pinned at `default` |
| `manual: true` | `auto: false` |
| `unpinned: true` | `auto: { on: true }` |
| `autoValue: x` | `auto: { value: x }` |
| `unpinned: true, autoValue: x` | `auto: { on: true, value: x }` |

`auto: false` with either of the others, which the old fields allowed, has no spelling now. The new `PrefAuto` type names the object form.

`PrefsForm` gives a leaf with `auto: false` no auto toggle. `PrefSchemaEditor`'s Auto panel keeps its three rows, Never auto, Starts auto and Auto value, and writes them all to `auto`; changing a leaf's kind keeps its `auto` but for the value, which belongs to the old kind and is dropped. labkit's auto stays opt-in, and its resolved schema now says so: `.auto()` writes `auto: {}` onto the resolved leaf, `.initial(auto)` writes `auto: { on: true }`, and every other leaf, a legacy `configSchema()` field included, gets `auto: false`. A leaf `f.prefs` carries over keeps the `auto` object its schema gave it. Every reader of a resolved labkit schema, `PrefsForm` and the schema editor among them, now finds the same answer labkit acts on.
