I couldn't write `.skulkr/out/findings.md` because the write wasn't approved, so the whole findings document is below.

# Audit round 64: area `quantity`

The brief names frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4, but that object isn't in this clone (`git cat-file` reports a bad object). These findings come from reading the working tree at HEAD 6f634fabe1, which has no uncommitted changes under `packages/quantity`.

## parseAs throws a TypeError instead of answering NaN for typed text holding a line break
- where: packages/quantity/src/infinity.ts:39 (readInfinity)
- scenario: `parseAs('1\n2', decimal())`, or any text with `\n`, `\r`, U+2028 or U+2029 inside it after the trim. `readInfinity` runs before every kind's parse. In `/^([+\-−]?)\s*(.*)$/`, `.` doesn't match a line terminator and `$` has no `m` flag, so `exec` returns null and `m![2]` throws "Cannot read properties of null". Such text can come from a paste, a textarea or a program. It should read as NaN, the answer the README promises for text a display can't read, and never throw.
- evidence: read
- severity: medium

## QuantityView.to rewrites a unit display's `unit` but keeps its `accepts`, so parsing after a conversion is off by the conversion factor
- where: packages/quantity/src/present.ts:186 (QuantityView.to)
- scenario: `qty(tag(12, unit('mm', { accepts: { mm: 1, cm: 10 } }))).to('cm', METRIC_MM)`. Its `.text` is `1.2cm`, but `.parse('1.2cm')` is 12, and `.parse('12mm')` is 12 where it should be 1.2. `accepts` maps "each unit to its conversion into the shown one", and the shown unit is now `cm`. But `shown()` copies the `mm`-relative table through unchanged, so `unitKind.parse` keeps answering in millimeters while the value is in centimeters. The fix: divide each entry by the target's factor relative to the old unit, or drop the table, as is done for `unit`.
- evidence: read
- severity: medium

## percent speaks a different number than it shows when value × 100 lands just under a half
- where: packages/quantity/src/kinds/proportion.ts:22 (percentKind.speak)
- scenario: value 0.145 with `percent()`. `format` passes 0.145 to `Intl` with `style: 'percent'`, and ICU scales the decimal exactly to 14.5, so it shows `15%`. `speak` multiplies in binary first: `0.145 * 100` is 14.499999999999998, which formats at 0 places as `14 percent`. The same happens for 0.285 (`29%` shown, `28 percent` spoken) and 0.565. Text and speech should round the same number: let `Intl` do the scaling in speak too.
- evidence: read
- severity: medium

## spinKey with an endless max sends ArrowDown from a value above max to Infinity
- where: packages/quantity/src/spin.ts:63 (spinKey)
- scenario: `spinKey('ArrowDown', 1000, { step: 1, max: 100, endless: 'max' })`.
  - `toTrack(1000)` is 1000.
  - `finiteSpin` steps to 999 and clamps it to the track's top, `hi` = 101.
  - The "lands on the bound first" guard needs `from < max`, which is false here.
  - So `fromTrack(101)` returns Infinity, and a step down moves the value up to infinity.

  Without `endless` the same key gives 100. A value from a prop or a programmatic set can sit past `max`. The mirror case, ArrowUp from below an endless `min`, gives −Infinity. A value outside the range should come back to the bound.
- evidence: read
- severity: low

## parseAs under a fraction counted in a constant reads digits past the range as Infinity
- where: packages/quantity/src/kinds/proportion.ts:241 (fractionKind.parse)
- scenario: `parseAs('1e308π', fraction({ of: 'π' }))`. `parseFraction('1e308')` is 1e308, and `* Math.PI` overflows to Infinity, which is returned unchecked. Everywhere else in the package an infinity reads only from a word, never from digits: `finiteOrNaN` in `readNumber`, `parseFraction`, `signedSeconds` and ratio, and the recent "read a unit scaled past the range of a number as NaN" fix. The product should go through `finiteOrNaN`.
- evidence: read
- severity: low

## scientific shows NaN as `NaN × 10⁰`, and MathML gets 10 to the 0
- where: packages/quantity/src/kinds/scientific.ts:29 (split), :60 (format)
- scenario: `present(NaN, scientific())`. `split` only special-cases 0. For NaN no `exponentInteger` digits are collected, so `Number('')` is 0. Format then appends ` × 10⁰`, speak says "NaN times 10 to the power of 0", and mathml writes an `<msup>` of 10 to the 0. Every other kind shows NaN as `NaN`. A non-finite value should take the same early return zero does.
- evidence: read
- severity: low

## readInfinity misses `Inf`/`Infinity`/`INF` in Turkish and Azerbaijani locales
- where: packages/quantity/src/infinity.ts:35 (readInfinity)
- scenario: `parseAs('Infinity', decimal(), { locale: 'tr-TR' })`. `toLocaleLowerCase('tr-TR')` maps `I` to dotless `ı`, so the text becomes `ınfinity` and isn't in `SPELLINGS`. The parse falls through to the kind and reads NaN, though the README says `inf` and `infinity` read "under any display". The `SPELLINGS` check should use the locale-independent `toLowerCase()`.
- evidence: read
- severity: low

## number shapes and field locales are cached without a bound
- where: packages/quantity/src/number.ts:129 (shapes / shapeOf), packages/quantity/src/fieldLocale.ts:9 (settled / fieldLocale)
- scenario: `shapes` gets an entry for every distinct locale string passed to `parseNumber`, `numberWithin`, `latinDigits` and `decimalOf`. `settled` gets one for every string passed to `fieldLocale`, including tags `Intl` refuses, which are stored mapped to `en-US`. Neither map is ever evicted. A server that formats per request with client-supplied tags (`-u-nu-…` and `-x-…` variants, or garbage) grows both without limit.
- evidence: read
- severity: low

## Files read
packages/quantity/src/catalog.ts
packages/quantity/src/composite.ts
packages/quantity/src/endless.ts
packages/quantity/src/fieldLocale.ts
packages/quantity/src/index.ts
packages/quantity/src/infinity.ts
packages/quantity/src/kind.ts
packages/quantity/src/kinds/measure.ts
packages/quantity/src/kinds/numeral.ts
packages/quantity/src/kinds/plain.ts
packages/quantity/src/kinds/proportion.ts
packages/quantity/src/kinds/scientific.ts
packages/quantity/src/localized.ts
packages/quantity/src/number.ts
packages/quantity/src/pbt.fixture.ts
packages/quantity/src/places.ts
packages/quantity/src/present.ts
packages/quantity/src/quantity.ts
packages/quantity/src/scaleBar.ts
packages/quantity/src/scope.ts
packages/quantity/src/spin.ts
packages/quantity/src/unitExpr.ts
packages/quantity/src/units.ts

<!-- done: 8 findings, files read: 23 -->