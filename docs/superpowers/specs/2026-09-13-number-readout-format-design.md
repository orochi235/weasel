# Number readout formats

For whoever builds or reviews this in weasel. It answers one question: how a
number pref says how its value is shown, so a large value reads as `2.0M`
rather than as a clipped `20000`.

## The problem

A slider's readout is plain digits in a box `calc(5em - 24px)` wide, so a
six-digit value like `200000` loses a digit and reads as `20000`. `SliderRow`
takes a `format` function, but nothing in a schema can reach it, and a formatted
readout cannot be edited: `parseSignedNumber('2.0M')` is `NaN`.

## Design

A number leaf can declare a named format. Two exist:

- `plain` — what every readout does today, and the default.
- `compact` — below 1,000, the step's own precision; from 1,000 up, one decimal
  and a magnitude suffix: `950`, `40.0K`, `200.0K`, `2.0M`, `12.3M`. Always
  formatted in `en-US`, so what it prints is what the parser reads back.

Typing into a readout accepts a plain number, a real minus sign (U+2212),
thousands commas in the `40,000` shape, and a `k`/`m`/`b`/`t` suffix in either
case: `2.5m` is 2,500,000. Anything else reverts, as an unreadable entry does
today. An empty entry now reverts too, where it used to commit `0`.

### Pieces

1. **`@weasel-js/core` `tools/prefs.ts`:** `ToolPrefNumberFormat = 'plain' |
   'compact'`, and `ToolPrefNumber.format?: ToolPrefNumberFormat`. Plain data,
   so it passes through labkit's resolver untouched.
2. **`@weasel-js/ui` `format/number.ts`:** `formatCompact(value, decimals)` and
   `parseNumber(text)`. `parseNumber` is a superset of `parseSignedNumber`,
   which stays exported unchanged.
3. **`@weasel-js/ui` `SliderRow`:** a `notation` prop picks the display — not
   `format`, which is already the row's function prop and keeps its meaning;
   given both, `format` wins. Its readout reads typed text through `parseNumber`.
4. **Readout width:** the readout always knows its widest value — the longer of
   its formatted `min` and `max` — and sets it as `--wzl-property-readout-fit`
   on the input. The stylesheet takes the larger of that and the existing width,
   `var(--wzl-property-readout-w, calc(5em - 24px))`, so a row whose values fit
   is unchanged and a consumer's own width setting still holds.
5. **`@weasel-js/ui` `PrefsForm`:** a slider leaf declaring `compact` shows it
   through `RangeSlider`'s `formatOutput`.
6. **`@weasel-js/labkit`:** `NumberNode.format(name)`, and `ControlPanel`
   passes a leaf's format to `SliderRow` as `notation`.

### Out of scope

`NumberRow` ignores `format`. It edits through a native `type="number"` input,
which cannot display `2.0M`; a compact typed number would need a text input and
its own stepping.

## Tests

- `formatCompact` at 0, below and across 1,000, at a rollover such as 999,950,
  and negative; `parseNumber` for every accepted shape and a rejected one each.
- `SliderRow` with `notation="compact"` shows `2.0M`, and a typed `2.5k`
  commits 2,500.
- The readout sets `--wzl-property-readout-fit` from its widest value. jsdom
  cannot lay out, so this asserts the property as a proxy; the width itself is
  checked in a browser.
- The builder records `format`; `ControlPanel` hands it to the slider.
