---
'@weasel-js/ui': minor
---

A `Tree` node takes `controls`, toggles at the row's end, and a tree with any is a treegrid whose controls Right reaches from the row.

Each row is then a `row` with its leading, label and trailing in one `gridcell` and its controls in a second. The controls leave the tab order: Right on a leaf or an open branch steps into them, Left and Right walk them, Left past the first or Escape returns to the row, and Up and Down from one move between rows. A click or a key on a control is the control's own and does not activate the row.

```tsx
<Tree aria-label="Layers" nodes={[{ id: 'a', label: 'Alpha', controls: <VisibilityToggle id="a" /> }]} />
```

<!-- entry: rank=10 new api -->
