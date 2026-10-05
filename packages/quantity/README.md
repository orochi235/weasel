# @weasel-js/quantity

Numbers with a unit and a display — how they show, how a screen reader says
them, and how typed text reads back. No React, no DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

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
| `percent()` | `25%` | `25 percent` |
| `fraction({ maxDenominator, mixed })` | `1/12`, `1 1/2` | `1 over 12`, `1 and 1 over 2` |
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
own word. `endless` gives it one:

```ts
import { decimal, endless, parseAs, qty, unit } from '@weasel-js/quantity';

const timeout = endless(unit('ms'), 'never');
qty(Infinity, timeout).text   // 'never'
qty(250, timeout).text        // '250ms'
parseAs('never', timeout)     // Infinity
endless(decimal(), { text: 'no cap', spoken: 'uncapped', negative: 'none' })
```

The word is one `infinity` part with no unit beside it. `parseAs` reads the
display's words back, and `∞`, `inf` and `infinity` under any display. JSON
has no Infinity, so a tagged `Infinity` serializes as `null`.

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

## License

MIT
