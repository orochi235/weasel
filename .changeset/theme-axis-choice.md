---
'@weasel-js/theme': major
---

The theme's `Selection` type is `AxisChoice`, since "selection" means the selected scene nodes everywhere else in weasel.

`fullSelection`, `enumerateSelections` and `selectionKey` are `fullAxisChoice`, `enumerateAxisChoices` and `axisChoiceKey`.

```ts
// before
const choice: Selection = fullSelection(themeAxes(theme), { mode: 'dark' });
// after
const choice: AxisChoice = fullAxisChoice(themeAxes(theme), { mode: 'dark' });
```

<!-- entry: breaking api -->
