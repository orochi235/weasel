---
'@weasel-js/ui': minor
---

New rail parts draw a list of pages as the prefs dialog does (`RailList`, `RailItem`, `RailName`), or one to select from (`RailListBox`).

`RailItem` is a button whose `current` makes it `aria-current` (`'page'` for `true`) and fills it with the accent. `RailListBox` is a react-aria `ListBox`, `RailOption` its `ListBoxItem` with the same `current`, and `RailSection` a `ListBoxSection` whose `guide` brackets its options as a `Tree` brackets an open branch, placed by `--guide-at` and `--guide-from`. `RailName` cuts a long name short with an ellipsis; give it `slot="label"` in an option.

```tsx
<RailList aria-label="Pages">
  <RailItem current onClick={() => open('canvas')}><RailName>Canvas</RailName></RailItem>
</RailList>
```

<!-- entry: new api -->
