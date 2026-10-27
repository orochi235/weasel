# Feature bundles

**Status: designed 2026-10-27, unbuilt.** Nothing below exists in the tree yet.

For whoever builds or reviews the rework of `<SceneCanvas features>` presets. It answers how actions,
tools, and the code that binds them get grouped into small units, how presets are composed from those
units, and how a person rearranges them in the asset editor.

## Terms

- **Bundle**: a `FeaturePreset` that holds only `actions`, `tools`, and `includes`. Pure grouping.
- **Atom**: a `FeaturePreset` with any code role: `ambient`, `moveBehaviors`, `chrome`, `chromeRules`,
  `pathEdit`, `snapSources`, `layers`, `contributions`, or `refines`. Its parts only work together, so
  it is never split. `resize` (action, handle chrome, and the ambient binding that routes a handle
  drag to the action) is an atom.
- **Preset** stays the general word for either, and the type stays `FeaturePreset`. No new runtime type.

Decided 2026-10-27: a bundle is data the editor can rearrange, and an atom is where "these must go
together" is enforced, in code (option A over making every code role an id-addressable part, which
would let the editor build combinations that do not work).

## Runtime changes

**Split core's coarse presets.** A preset that mixes loose actions becomes a bundle of smaller
bundles. The starting split, which the editor exists to rearrange:

| Today | Becomes |
|---|---|
| `edit` (21 actions) | bundle `edit` including `escape` (escape, cancel gesture), `contextMenu`, `selectAll`, `duplicate` (duplicate, transform again), `delete`, `group` (group, ungroup), `nudge` (4), `style` (fill, stroke, both opacities), `clipboard` (cut, copy, paste, paste event) |
| `arrange` (11) | bundle `arrange` including `flip`, `reorder` (2), `align` (6), `distribute` (2) |
| `paths` (34, `refines: ['edit']`) | atom `anchorKeys` (anchor nudge ×4, delete anchors; `refines: ['nudge', 'delete']`) and bundles `pathfinder` (8 booleans, boolean group), `outlines` (2), `pathEdit` (the 14 enter/exit/anchor/handle/segment actions), `pathCommands` (simplify, offset, snip, join) |
| `view`, `select`, `ingest` | bundles, unchanged in content |
| `outline`, `move`, `resize`, `rotate` | atoms, unchanged |

`refines` is code, so it only appears on atoms. `anchorKeys` names the bundles whose keys it must be
tried ahead of; an atom's `refines` may name a bundle id, and resolution places the atom ahead of
every atom and action that bundle brings.

**Tool bundles.** One per `ToolSet`, by the set's id: `tools:select` (select, lasso), `tools:view`
(hand), `tools:shape`, `tools:draw`, `tools:type`, `tools:page`. `ToolSet`s stay: they are palette
groups, and a tool bundle is built from one. `select` and `view` include their tool bundle rather than
naming a tool, which also gives the lasso tool its first preset.

**Composites become presets.** `pick`, `transform`, and `draw` become bundles that `include` others.
`COMPOSITE_FEATURES` and the `CompositeFeature`/`BaseFeature` split are removed; `features={['draw']}`
resolves by looking the id up in core's named presets, as a base name does today. `FEATURE_ACTION_IDS`
is rebuilt from the bundles.

**Packages** keep shipping their own presets. path-tools already does this (`pathTools` includes one
preset per tool family). guides' `createGridPreset` and `createSpacingHintsPreset` are atoms.

**The toolkit builder** (`apps/draw/src/dev/ToolkitBuilder.tsx`) drops its `BUNDLE_DEFAULT_TOOLS`
(minimal/standard/exhaustive) and picks from the described presets instead. The bundle inspector's
`collectBundles` lists presets the same way.

## Reflection

Core exports `describePresets(presets)`, returning one record per preset reachable from the ones
given, `includes` followed:

```ts
interface PresetDescription {
  id: string;
  label: string;
  atom: boolean;                 // has any code role
  actions: readonly string[];    // action ids, in registration order
  tools: readonly string[];      // built-in tool ids, sets opened, and own tools' ids
  includes: readonly string[];   // preset ids
  package: string;               // '@weasel-js/core', '@weasel-js/path-tools', …
}
```

`FeaturePreset` gains an optional `label` for this; an absent one reads as the id. The editor's host
(apps/draw's `AssetsPage`) passes core's named presets plus the packages' it loads.

## Editor: a Bundles asset

A new asset kind, `'bundles'`, filed under a new heading **Bundles** in the asset list, drawn by
`StructurePane` like the other assets.

- **Tree.** The root holds one section per package; each top-level group under it is a bundle.
  Leaves are of three new kinds, each naming one thing by id: `action` (the existing `PrefAction`
  leaf), `tool`, and `atom`. A bundle included in another is a link to that bundle's group (the
  tree's existing link drag), not a copy.
- **Atoms** show as one locked row each: movable, not expandable. Their actions and tools are listed
  read-only in the attributes pane.
- **Drag source.** A catalog of every action, tool, and atom the host knows, beside the existing
  Actions pane. A row already in some bundle shows where.
- **Checks shown on the row, not enforced:** a bundle included in itself through a cycle, and an
  id that appears in two bundles one canvas would load together.
- **`StructurePane` changes.** It already takes `kinds`. What else in it assumes a pref schema (pages,
  values, `over`) is not yet surveyed; the plan's first task reads it and lists what a bundle tree
  needs turned off.

## Export: JSON for an agent

The editor writes no code. The Bundles asset's export tab shows, and Submit sends:

```json
{
  "format": "weasel-bundles/1",
  "base": "<hash of the describePresets output the editor opened on>",
  "bundles": [
    { "id": "edit", "package": "@weasel-js/core", "label": "Edit",
      "members": [{ "kind": "bundle", "id": "clipboard" }, { "kind": "action", "id": "delete" }] }
  ],
  "changes": [
    { "op": "move", "kind": "action", "id": "delete", "from": "delete", "to": "edit" }
  ]
}
```

`bundles` is the whole edited tree for the packages that changed; `changes` lists each edit against
`base` (`create`, `remove`, `rename`, `move`, `include`, `exclude`). An agent applies it to the preset
source files and reruns `describePresets` to confirm the result matches `bundles`. An atom never
appears as edited, only as a member.

## Testing

- `describePresets` round trip: describing core's presets and rebuilding membership from the result
  gives every action and tool exactly the bundles it had.
- The split preserves behavior: `presetActions(resolve(['draw']))` registers the same action ids
  before and after, in an order every `refines` rule still holds.
- Editor: the export of an unedited tree has no `changes`; one move produces one `move` change.

## Out of scope

- Runtime bundles stored as data, or edited by an app's users (decided 2026-10-27: authoring only).
- Splitting atoms.
