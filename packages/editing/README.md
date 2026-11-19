# @weasel-js/editing

Editing for a weasel canvas, as presets an app opts into. `@weasel-js/core`
draws a scene and pans and zooms it; the presets here add what an editor does
with it: selecting, moving, resizing and rotating, the edit, arrange and
Pathfinder commands, and paste and drop.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/editing).

```sh
npm install @weasel-js/editing
```

## On a canvas

```tsx
import { SceneCanvas } from '@weasel-js/core';
import * as presets from '@weasel-js/editing/presets';

<SceneCanvas scene={scene} features={[presets.draw]} />
```

`presets.draw` is every preset at once. Each part can be passed alone:
`presets.pick` (select and the selection's outline), `presets.transform` (resize
and rotate handles), `presets.move`, `presets.edit` (escape, select all, delete,
duplicate, group, nudge, style and the clipboard, each also a preset of its
own), `presets.arrange` (flip, reorder, align, distribute), `presets.pathfinder`,
`presets.ingest`, and the tool presets `presets.selectTools` and
`presets.shapeTools`. Core's `presets.view` pans and zooms; a canvas given only it
is a viewer, whose selection nothing it runs writes. The presets are on
`@weasel-js/editing/presets` only, never the main entry; core's `view` and
`viewTools` are there too, the same objects `@weasel-js/core/presets` exports.

The tools are editing's, offered to a canvas by id: `presets.selectToolsOffered`
offers the select tool and the lasso, `presets.shapeToolsOffered` the rect, ellipse,
line, polygon and star, and `defaultTools={['rect']}` mounts one wherever a
preset offers it (`presets.draw` offers them all). `presets.selection`, which every
editing preset includes, builds the canvas's selection; `useSelection` is the
same selection as a hook, for a panel or a host that keeps its own. A host of
another dimension takes `usePickerSelectTool`, `createSelectionMoveContribution`,
`useGroupEntryContribution` and `ENGINE_STANDARD_ACTIONS` from
`@weasel-js/editing/engine`, which loads none of the presets.

Where presets are picked by name, `namedFeatures('pick', 'move')` returns the
objects, `FEATURE_NAMES` lists the names, and `FEATURE_ACTION_IDS` says which
preset registers which action. `useStandardActions` registers every kit action
into the providers around it, for a host that is not a `<SceneCanvas>`.

## What edits act on

Every editing action acts on the `operands` dep, which core declares. The
canvas answers it with its selection; a host points edits elsewhere by sourcing
its own:

```tsx
import { createOperandList } from '@weasel-js/core';

useDepSource('operands', () => createOperandList([a, b]));
```
