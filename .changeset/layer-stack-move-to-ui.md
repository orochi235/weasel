---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Move `LayerStack` from `@weasel-js/labkit` to `@weasel-js/ui`. It is a generic
drag-reorderable stack of expandable cards — it reads nothing from labkit's
instrument, config, state, trial or lab layers — and a consumer who wanted it
had to take labkit and the lab frame it assumes.

It can now be imported from `@weasel-js/ui` directly. **Existing
`@weasel-js/labkit` imports keep working**, from both the package root and
`@weasel-js/labkit/ui/layers`: labkit re-exports it, and it bundles weasel-ui
into its own dist, so this is a re-export rather than a new dependency.

`DragHandleGlyph`, the grip both `LayerStack` and labkit's `LayerList` draw,
moves with it and is now public from `@weasel-js/ui`.

`LayerStack` also takes a `className` now, appended to its root — the
supported way to reach it from a consumer stylesheet, since its own class
names are hashed.

The class names are no longer public. The stylesheet moved from global
`lk-`-prefixed Less to a CSS module, matching the package it joined, so
`lk-layer-stack`, `lk-layer-card` and their neighbours no longer exist as
targetable selectors, and `--lk-layer-card-accent` is now
`--wzl-layer-stack-accent`, set for you by the `accent` prop on an item. The
card's `data-testid` drops the `lk-` prefix: `layer-card-<id>`.

Two of the old rules were prefixed with `.lk-root` to outrank labkit's bare
`button` defaults. Those defaults now sit at zero specificity, so the module's
own class wins on its own; the stack no longer depends on a labkit ancestor,
and it restates the border-box reset and the button font and height that
`.lk-root` used to supply.
