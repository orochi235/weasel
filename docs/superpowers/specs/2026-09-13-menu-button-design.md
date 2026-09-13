# MenuButton

For whoever builds or reviews this in weasel. It answers one question: what
labkit's "Add trial…" and "Load…" controls should be, since neither one picks a
value.

## The problem

Both were `Select`s held at `selectedKey={null}`, so they only ever showed
their placeholder. A `Select` fills its row by default, so each carried a
fixed-width pin (160px and 88px) to keep it from taking the slack.
`width='fit'` would size each one to its longest row instead: the longest
instrument name, or the longest snapshot name someone has typed. Neither
control holds a value. Each is a button that opens a list and acts on the row
chosen, and `@weasel-js/ui` had no component shaped like that.

## Design

**`@weasel-js/ui` `MenuButton`** wraps React Aria's `MenuTrigger`, `Menu` and
`MenuItem`:

```ts
<MenuButton label="Add trial…" aria-label="Add trial" items={[{ value, label }]} onAction={(value) => …} />
```

- The trigger always shows `label` and sizes to it (`inline-flex`, `flex:
  none`). The list is at least as wide as the trigger and grows to its widest
  row.
- Rows are menu items, so a screen reader hears a menu of actions rather than
  a listbox with nothing selected. A disabled row does not fire `onAction`.
- The list renders through `useOverlayPortal`, as `Select`'s does, so it picks
  up the nearest theme.
- The trigger and list reuse `Select`'s look: the sunken field, the raised
  list, and the same focus ring. The label uses the placeholder color, since
  it reads as a prompt.

**labkit:** `LabHeader`'s multi-instrument "Add trial…" and the toolbar's
"Load…" both become `MenuButton`s, and both width pins are deleted.

## Tests

`MenuButton`: it is a named button, choosing a row calls `onAction` with its
value, its label survives the choice, and a disabled row does nothing.
`LabHeader`: several instruments give a button with a popup, and choosing one
adds a trial of that instrument.
