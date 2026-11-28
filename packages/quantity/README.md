# @weasel-js/quantity

Numbers with a unit and a display — how they show, how a screen reader says
them, and how typed text reads back. No React, no DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/quantity).

```sh
npm install @weasel-js/quantity
```

## A quantity is a number, or a number with a tag

```ts
import { qty, tag, retag, fraction } from '@weasel-js/quantity';

const seam = tag(1 / 12, fraction());   // { value: 0.0833…, display: { kind: 'fraction' } }
qty(seam).text     // '1/12'
qty(seam).spoken   // '1 over 12'
qty(seam).html     // '<data value="0.0833…"><span data-part="numerator">1</span>/<span data-part="denominator">12</span></data>'
qty(seam).mathml   // '<math><mfrac><mn>1</mn><mn>12</mn></mfrac></math>'

retag(seam, 1 / 6) // still tagged, still a fraction
retag(0.5, 0.25)   // a bare number stays bare
```

`Quantity` is `number | { value, unit?, display? }`. A bare number costs
nothing; a tagged one keeps its presentation as it moves, because code that
changes a value writes it back with `retag`. A display is plain data, so a
tagged value survives JSON, history snapshots and `structuredClone`.

`qty(q, fallback)` wraps a quantity for display. `fallback` is the display for a
value that carries none of its own — a value's own tag wins. Nothing about the
wrapper is stored.

## Displays

| Builder | Shows | Spoken |
|---|---|---|
| `decimal({ places })` | `1,234.57` | `1,234.57` |
| `integer()` | `42` | `42` |
| `compact()` | `2.00M` | `2 million` |
| `scientific({ digits, engineering, form })` | `1.23 × 10⁶`; `engineering` `12.3 × 10³`; `form: 'e'` `1.23e6` | `1.23 times 10 to the power of 6` |
| `percent()` | `25%` | `25 percent` |
| `fraction({ maxDenominator, mixed, form })` | `1/12`, `1 1/2`; `form: 'diagonal'` `¹⁄₁₂`; `form: 'stacked'` drawn as MathML | `1 over 12`, `1 and 1 over 2` |
| `ratio()` | `1:12` | `1 to 12` |
| `multiplier()` | `2.5×` | `2.5 times` |
| `zoom()` | `150%`, `2.5x` | `150 percent`, `2.5 times` |
| `unit('mm', { accepts })` | `12mm` | `12 millimeters` |
| `currency('USD')` | `$12.50` | `12.50 US dollars` |
| `duration({ style })` | `1:02:03`, `2h 5m 3s` | `1 hour, 2 minutes, 3 seconds` |
| `bytes({ base })` | `1.2 MB`, `1 KiB` | `1.2 megabytes`, `1 kibibyte` |
| `roman()` | `XII` | `12` |
| `ordinal()` | `22nd` | `22nd` |

Every display parses its own text back (`parseAs('1 1/2', fraction())` is
1.5), and NaN is the answer for text it cannot read. A display whose kind is
not registered shows as `decimal` and keeps its tag, so a document saved by an
app with a custom kind still opens in one without it.

## Infinity

Every display shows ±Infinity, as `∞` (spoken `infinity`) unless it names its
own word. `withInfinity` gives it one:

```ts
import { decimal, withInfinity, parseAs, qty, unit } from '@weasel-js/quantity';

const timeout = withInfinity(unit('ms'), 'never');
qty(Infinity, timeout).text   // 'never'
qty(250, timeout).text        // '250ms'
parseAs('never', timeout)     // Infinity
withInfinity(decimal(), { text: 'no cap', spoken: 'uncapped', negative: 'none' })
```

The word is one `infinity` part with no unit beside it. `parseAs` reads the
display's words back, and `∞`, `inf` and `infinity` under any display. JSON
has no Infinity, so a tagged `Infinity` serializes as `null`.

## Tones

Every display can color its value by the band the value falls in. `withTones`
adds a ramp: a band list (`Band<Tone>[]`, the same model `BandEditor` edits)
whose every band carries a CSS color and, optionally, a name.

```ts
import { percent, present, rarityTones, withTones } from '@weasel-js/quantity';

const score = withTones(percent(), rarityTones());
const p = present(0.93, score);
p.tone    // { color: '#e8820c', name: 'legendary', index: 4 }
p.text    // '93%'
p.spoken  // '93 percent, legendary'
p.html    // '<data value="0.93" data-tone="legendary">…</data>'
```

| Field | Meaning |
|---|---|
| `stops` | The bands. A value takes the color of the last stop whose `from` is at or below it; past either end it takes the end color, ±Infinity included. NaN has no tone. |
| `over: [min, max]` | Each `from` is a fraction of `[min, max]` rather than a value. |
| `blend: true` | Mix neighboring colors in OKLab instead of stepping. The name and index stay those of the stop at or below the value. A color that doesn't parse (a `var(--…)`) can't be mixed, so that pair steps and warns once. |
| `speak: false` | Keep the tone's name out of the spoken text. By default it is spoken, since color alone doesn't carry meaning to everyone. |

The HTML stays unstyled: the `<data>` gets `data-tone`, the stop's name or else
its index, for a stylesheet to color. Text and parsing are unchanged.
`rarityTones(over)` is a ready ramp of common, uncommon, rare, epic and
legendary (the top tenth), in gray, green, blue, purple and orange; `toneAt` and
`toneOf` answer the tone without presenting.

## Adding a kind

```ts
import { registerDisplayKind, fractionKind } from '@weasel-js/quantity';

registerDisplayKind({ kind: 'hex', format: (v) => [{ type: 'number', value: `0x${v.toString(16)}` }] });
registerDisplayKind({ ...fractionKind, speak: (v) => toWords(v) }); // replaces the built-in
```

A kind returns parts — `{ type, value }` runs, the way `Intl`'s
`formatToParts` does. The text is the parts joined; the HTML wraps each
non-literal part in a `<span data-part>`, which is the whole styling surface.

## Units

`UnitSystem` tables convert between units of one dimension (`METRIC_MM`,
`IMPERIAL_INCHES`, `ANGLE_RADIANS`, `PIXELS`). `qty(tag(12, unit(), 'mm')).to('cm', METRIC_MM)`
is `1.2cm`. `parseNumber('5ft 3in', { in: 1, ft: 12 })` is 63.

The unit catalog says everything else a unit's name decides: its symbol, a compact form for tight
spaces, the aliases that read as it, its spoken names, and whether its glyph attaches to the number.

```ts
unitSymbol('deg')                     // { text: '°', attaches: true, … }
unitSymbol('in', { compact: true })   // { text: '″', attaches: true, … }
present(3, unit('in', { compact: true })).text   // '3″', spoken '3 inches'
parseNumber('5’ 3”', { in: 1, ft: 12 })          // 63: any spelling the catalog knows
registerUnit({ name: 'furlong', symbol: 'fur', spoken: ['furlong', 'furlongs'] })
```

A field or readout in `@weasel-js/ui` keeps an attaching unit on the value's line and out of flow.

A `UnitScope` nests one system in another: a sub-assembly measured in millimeters inside a
drawing measured in inches, with `scale` saying what one millimeter is worth in inches. A chain
of scopes runs outermost first, and `resolveScoped` and `formatScoped` convert across it:

```ts
const INCHES = { system: IMPERIAL_INCHES };
const MM = { system: METRIC_MM, scale: 1 / 25.4 };
resolveScoped({ value: 10, unit: 'mm' }, [INCHES, MM])   // 0.3937…, in inches
formatScoped(1, 'mm', [INCHES, MM])                      // '25.4mm'
```

A scope converts what is shown, typed and snapped to, never what is stored: a value is held in
the outermost scope's units however deep it sits (ruled 2026-10-20). In weasel a container
declares one (`GroupNode.units`), its children's poses stay in world units, and pose
composition does not scale by it. `sceneUnitScopes` and `sceneSharedUnitScopes` in
`@weasel-js/core` read a scene's chain; `unitScopedPrefUnit` and `prefLeafInUnitScopes` in
`@weasel-js/prefs` make a field's unit from one; `gridSnapSource`'s `scopes` option in
`@weasel-js/guides` snaps on one.

## License

MIT
