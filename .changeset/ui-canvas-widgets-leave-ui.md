---
'@weasel-js/ui': major
'@weasel-js/ui-canvas': minor
---

`SelectionPanel`, `AnchorFields`, `CharacterOptions`, `Rulers` and `PlotDataPanel` move from `@weasel-js/ui` to `@weasel-js/ui-canvas`.

This is breaking: import them, with their props types, `CHARACTER_OPTIONS`, `isCharacterChrome`, `HandleCoords` and `PlotTableView`, from `@weasel-js/ui-canvas`, or from `@weasel-js/ui-canvas/components/inspector/SelectionPanel` and the other subpaths `@weasel-js/ui` had for them. Load `@weasel-js/ui-canvas/style.css` beside ui's.

```ts
import { SelectionPanel } from '@weasel-js/ui-canvas/components/inspector/SelectionPanel';
```

<!-- entry: rank=20 breaking api -->
