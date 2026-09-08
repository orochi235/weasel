---
'@weasel-js/labkit': patch
---

An instrument's config can nest. `f.group({ … })` is a branch:
`grid: f.group({ size: f.number(20) })` puts the value at `config.grid.size`
and addresses it as `'grid.size'`. Groups nest arbitrarily and chain
`.label()`, `.describe()`, `.section()` and `.showIf()`, which hides the whole
subtree. `.section()` is unchanged — a heading over sibling rows that leaves
their paths alone.

`resolveConfigSchema` emits a nested `PrefGroup` whose dotted paths *are* the
config paths, which is what weasel-ui's `PrefsForm` already walks, so both
renderers address a schema identically. `ControlPanel` renders a nested group
as a `PropertyGroup` under its own heading; fold state keys stay bare labels at
the root, so stored folds still match.

Writes go through a path write that copies the spine and leaves untouched
branches at their old identity. `onConfigChange` receives a `nextConfig` built
the same way, so a nested change arrives with its sibling branch intact.

A config stored before its schema grew a branch loads: `createLabStore` takes
`configDefaults` and deep-fills every hydrated trial and saved snapshot before
deserialization, so an instrument's `deserialize` always sees a complete
config. Filling is idempotent, never rewrites storage on its own, and keeps
keys the schema no longer names. It makes an old config load; it cannot move a
value, so an author renaming `gridSize` to `grid.size` keeps the old key and
gets the new one at its default. A per-instrument `migrateConfig` is the
separate piece that would close that.

`seedConfig` uses the same merge, which fixes `addTrial({ config })` and Reset
replacing a whole branch when the seed named one leaf of it.

The config setters take a path now: `ControlPanelProps.setConfig` and
`RenderContext.setConfig` are `(path: string, value: unknown)`,
`updateTrialConfig` lost its phantom generic, and `SectionSpec` gained a
required `at` naming the group that owns it.

A group's `.describe()` reaches `PrefsForm` but not `ControlPanel`, which has
nowhere to put it.
