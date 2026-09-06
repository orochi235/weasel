---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`SliderRow` gets a live/commit pair, and a `PropertyGroup` can fold away.

**`SliderRow` now takes `onInput` alongside `onChange`** — the pair `<Slider>`
already spells. `onInput` fires through the drag, `onChange` once it ends, so a
control whose write is expensive (a re-simulation, a refetch) can say "on
release". The commit half is the platform's own: a range input fires `input`
continuously and `change` when the value settles. A typed readout reports to
both. A row given only `onChange` is unchanged — that one callback stays the
live write and there is no separate commit.

**`PropertyGroup` collapses.** `collapsible` puts a `<Disclosure>` twisty
beside the title; `defaultCollapsed` starts it folded and leaves the state with
the group; `collapsed` + `onCollapsedChange` hand that state to the consumer.
Folded rows stay mounted and hidden, so a control's local state survives being
put away.

`ControlPanel` passes it through to a schema's sections. `collapse="closed"`
folds them all; `collapsed` — a map keyed by section label — plus `onCollapse`
put the open/closed state somewhere a lab can keep it. A panel that sets
neither renders exactly as before.
