# Tuning rail: what `ConfigField` owes a rail — design spec

**Date:** 2026-08-22
**Status:** Draft
**Package paths:** `src/controls/`, `src/instrument/`, `src/state/`, and
`Slider` in `@weasel-js/ui`
**Depends on:** the vocabulary refresh — this spec uses `trial` for what the
code calls a workspace today.

`ConfigField` describes a settings form. A rail you *tune a renderer with*
is a different thing, and the gap is six features wide. Each was hand-rolled
in klieg's 653-line `Rail.tsx`; this puts them in the schema.

## What a rail needs

- **`hint`** — hover text saying what a control does and what it interacts
  with badly. The fastest way back into a model you left a week ago.
- **Commit at drag end** — a spec change there rebuilds sixteen panels:
  1.45 s front-only, 2.85 s with back, wall and connectors. A slider must
  cost one rebuild per drag, not twenty. This is not `debounceMs`: the need
  is "fire when the drag ends", not "fire less often".
- **`stops`** — detents the drag catches where a value marks a real
  boundary. Not `step`, which quantizes uniformly and says nothing about
  which values matter.
- **Lens binding** — a real spec is nested (`select.amount`, `corners.break`)
  and one control can write a derived value. That rail's corner slider
  writes a break/connect *ratio*, which no key names.
- **Inert with a reason** — two of that rail's controls do nothing under
  either shipped look, both being front-only. Today that is prose in a hint.
  It should be a state the panel renders.
- **Computed bounds** — one field is pinned between a count below and a
  minimum above, and at one setting is pinned across its whole range. A
  field should declare a derived min/max and show when it has no room.

## Schema additions

On `ConfigFieldBase`:

```ts
hint?: string;
commit?: 'live' | 'end';                     // default 'live'
inert?: (model: TC) => string | false;       // the reason, or false
bounds?: (model: TC) => { min: number; max: number };
```

On `SliderField`:

```ts
stops?: number[];
```

`commit` defaults to `'live'`, which is what every field does today. A rail
sets `'end'` per field; nothing changes for a field that does not ask.

`inert` and `bounds` both read the current config, so `ConfigField` becomes
generic in it: `ConfigField<TC>`, and `Instrument.configSchema` becomes
`() => ConfigField<TC>[]`. It already knows `TC`, so instruments written
against the current schema keep compiling; what changes is that
`ControlPanel` and `validateConfigSchema` carry the parameter through
instead of erasing it to `unknown`.

`inert` returns the reason rather than a boolean so the panel can render it.
A control that is inert renders disabled with its reason shown — not as a
hint you have to hover to find, because a control that silently does nothing
is the failure this replaces.

`bounds` is evaluated against the current model on every render. When
`min >= max` the field renders a *no room* state: the control is disabled
and says so. A slider with `bounds` ignores its static `min`/`max`.

## Lens binding

`ConfigField` becomes a union — a field declares either a key or a lens:

```ts
type FieldBinding<TC> =
  | { key: string }
  | { get: (model: TC) => unknown; set: (model: TC, value: unknown) => TC };
```

A lens `set` returns the whole config rather than patching one key, because
the motivating case writes two model values from one control.

Two write paths follow, both additive:

```ts
// LabStoreActions
updateTrialConfigWith: <TC>(id: string, updater: (prev: TC) => TC) => void;

// RenderContext
setConfigWith: (updater: (prev: TC) => TC) => void;
```

The keyed `updateTrialConfig` / `setConfig` stay exactly as they are. A
keyed field routes through them; a lens field routes through the updater
form. `onConfigChange(config, prev, state)` is unaffected — it already
receives whole configs.

`validateConfigSchema` gains three rejections: a field declaring both `key`
and a lens, a `stops` entry outside `[min, max]`, and a lens field whose
`get` throws against `defaultConfig()`.

## `ControlPanel` moves onto `@weasel-js/ui`

`ControlPanel` hand-rolls `<input type="range">`, `<input type="checkbox">`
and the rest, while labkit re-exports ui's `Slider`, `NumberField`,
`Select`, `Checkbox` and `Input` to its own consumers from
`src/passthrough/weasel-ui.ts`. Two control implementations, one of them
worse, and the better one is already a dependency. `ColorField` is the one
control ui has that labkit does not re-export; the rewire adds it.

The rewire is also what makes `commit` cheap. ui's `Slider` already splits
`onInput` (continuous through a drag) from `onChange` (once, at the end) and
documents `onChange` as the one to write to history — exactly this
distinction. `commit: 'end'` becomes a choice of which callback writes;
`commit: 'live'` writes from both.

This deletes labkit's parallel control CSS in `ControlPanel.less` and moves
`ControlPanel.test.tsx` onto ui's DOM. Field types keep their names and
their behavior; only what renders them changes.

## `stops` in `@weasel-js/ui`

The one addition outside labkit. `Slider` gains `stops?: number[]`: a drag
snaps to a stop within a threshold, and arrow keys step stop to stop when
stops are present. It composes with `step` — stops are attractors, `step`
still quantizes between them — and with per-thumb `bounds`, which is
neighbor-relative and unrelated to a field's model-derived `bounds`.

## Testing

- A `commit: 'end'` slider writes once per drag; `'live'` writes per move.
- A lens field's `set` result reaches the store whole, and a keyed field
  still takes the keyed path.
- `inert` returning a string disables the control and shows the reason;
  returning `false` leaves it live.
- `bounds` collapsing to `min >= max` renders the no-room state.
- A drag near a stop lands on it; a drag far from every stop does not.
- `validateConfigSchema` rejects each of the three malformed cases.
