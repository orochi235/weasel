---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

`useSelection` moves to `@weasel-js/editing`, and a canvas with no editing preset keeps a selection nothing it runs writes.

This is breaking. Editing's presets include `selectionPreset`, whose `createSelection` factory builds the selection a canvas writes through, answering clicks by `selectionOptions`. Without one, the canvas's selection is core's `viewerSelection`: it reads the scene's selection and ignores every write the canvas's tools, actions and adapter make, while the app, undo and redo still move it. `selectionOptions.initial` seeds an empty scene either way, and `<SceneCanvas selection>` still takes any `SelectionApi`.

```ts
// before
import { useSelection } from '@weasel-js/core';
// after
import { useSelection } from '@weasel-js/editing';
```

`useSelection`, `createSelection` and `UseSelectionOptions` are editing's, on its main entry and `./engine`. Core keeps the contract: `SelectionApi` (from `@weasel-js/routing`), `SelectionOptions`, `SelectionFactory`, `SelectionStore`, and `viewerSelection`.

<!-- entry: rank=10 breaking api behavior -->
