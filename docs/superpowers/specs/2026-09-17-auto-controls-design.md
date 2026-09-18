# Auto (unpinned) controls

For whoever implements this. A labkit control can be set to *auto*: the reader
stops pinning a value and lets the instrument decide. Shift-click a row to
toggle. This spec covers the schema surface, where the auto state lives, the
gesture, and the row styling.

"Auto" here is the CSS sense — the value is not overridden — not a disabled
input. An auto row is still operable; grabbing its control pins it.

## Schema surface

Every leaf is autoable with no annotation. `auto` is a value in the
vocabulary, exported beside `f`, and two new builder calls sit on `BaseNode`:

```ts
import { auto, f } from '@weasel-js/labkit';

gap:   f.number(12).auto((c) => c.width / 24),   // pinned at 12; ghosts to 18 when auto
cols:  f.number(3).initial(auto),                // starts auto - instrument sees undefined
seed:  f.number(1).manual(),                     // never auto; gesture inert, no dot
label: f.string('Hi'),                           // autoable, nothing declared
```

- **`.auto(resolve)`** attaches a resolver, `(config) => T`. Purely additive:
  it gives the ghost a real value to draw and means the instrument reads a
  value rather than writing `?? compute()`.
- **`.initial(auto)`** starts the field auto. Independent of whether a resolver
  exists. It takes `auto` and nothing else - typed so `.initial(5)` is a
  compile error, because `f.number(3)` already declares the value and two
  defaults would fight.
- **`.manual()`** opts the field out. The row takes no dot and ignores the
  gesture. This is what makes autoable-by-default safe for a value the
  instrument cannot receive as `undefined` - a color going straight to a
  uniform.

`.initial(auto)` on a `.manual()` field is a schema error, caught by
`validate`.

Carried on `NodeOptions` as `auto?: (config) => unknown`, `unpinned?: boolean`,
`manual?: boolean`, and surfaced on the resolved leaf so `ControlPanel` can
read them the way it reads the other labkit-only extras (`extra<T>(leaf, key)`).

## `auto` as a value

`auto` is a unique symbol. It is accepted anywhere a config value is written,
and normalized into the auto-path set on the way in - it is never what gets
stored:

```ts
addTrial({ configSeed: { cols: auto } });
setConfig('gap', auto);
```

So there is no parallel write API for the auto state: one way to write a
field, the same as any other value. Writing a real value to an auto path pins
it, which is also what grabbing a ghosted control does.

Because the sentinel is normalized away at the boundary, the stored config
keeps its last pinned value and a serialized trial contains no sentinel. The
type of `setConfig` widens to `ValueAtPath<TC, P> | typeof auto`.

## Where the auto state lives

Beside `config`, never inside it. `TrialRecord` grows `auto?: readonly
string[]` — the dotted paths currently unpinned — serialized with the trial, so
a reloaded trial comes back the way it was left.

The raw config keeps its last pinned value at an auto path. Un-pinning is
therefore lossless: shift-click twice and the slider is back where it was.

`resolveAutoConfig(schema, config, autoPaths)` produces what the instrument
receives:

- a path with a resolver → `resolve(config)`
- a path without one → deleted, so the instrument reads `undefined`
- everything else → the stored value

Resolvers run in schema order against the partially-resolved config, so one
auto field may read another. A cycle throws at resolve time naming the path;
it is a schema bug, not a runtime condition to recover from.

`useTrialState` returns the resolved config as `config` — the instrument never
sees the raw one. It also returns `auto: ReadonlySet<string>` and `raw: TC`,
which `Trial` passes down to `ControlPanel`. The panel renders from `raw`, so a
ghosted slider sits at its last pinned position when there is no resolver, and
toggles by writing `setConfig(path, auto)` or `setConfig(path, raw[path])`.

## Gesture

**Shift + pointerdown** anywhere in an autoable row toggles it. It must be
capture-phase with `preventDefault()` and `stopPropagation()`: `PropertyRow` is
a `<label>`, so a shift-click landing on a slider track would otherwise jump
the value on the way to going auto.

**The pin dot** toggles too. It is a real `<button aria-pressed>` in the row's
label span, beside the ⓘ — the same slot, the same tab-stop treatment. It is
invisible at rest, appears on `:hover` / `:focus-within`, and is always visible
on a row that is auto. Tabbing to the control triggers `focus-within`, so the
dot materializes and lands next in the tab order: a keyboard user can both pin
and un-pin.

**Grabbing a ghosted control pins it** at whatever value the interaction lands
on. No separate affordance — the control is ghosted, not disabled.

## Row styling

`PropertyRow` and the seven row kinds (`SliderRow`, `NumberRow`, `SelectRow`,
`ToggleRow`, `CheckboxRow`, `ColorRow`, `TextRow`) take `auto?: boolean` and
`onAutoChange?: (next: boolean) => void`. labkit owns the state; the rows own
the look. The dot renders only when `onAutoChange` is given, so existing
`@weasel-js/ui` consumers of `PropertyRow` are untouched.

`.rowAuto` in `Properties.module.css`:

- label dims to `--wzl-fg-subtle`
- readout goes italic, reading `auto · 18 px` where a resolver gave a value and
  `auto` alone where none did
- the control draws ghosted: dashed track, hollow thumb, dashed border on
  select/number/text
- **accent tokens are redefined muted within the row's scope** — the slider
  fill, the thumb, a checked checkbox, the focus ring. An auto row is
  colorless as well as ghosted. Redefined as custom properties on `.rowAuto`,
  not overridden per rule, and never with `!important`.

## Testing

Unit (jsdom): `resolveAutoConfig` across resolver / no-resolver / nested paths /
cycle; `.initial(auto)` + `.manual()` rejected by `validate`; `setConfig(path,
auto)` round-tripping without losing the pinned value; the sentinel absent from
the serialized `TrialRecord`.

The gesture is **not** honestly testable in jsdom: `preventDefault` on a label
has no consequence there, so a test asserting "the slider did not move" passes
against the broken implementation too. The test asserts that `preventDefault`
was called on the shift-pointerdown, and says in the test that it is a proxy
for the browser behavior.

The ghost and the desaturation are CSS, which jsdom resolves not at all — they
get a storybook screenshot check in the labkit storybook project, one story
covering a pinned row and an auto row of each kind, in both modes.
