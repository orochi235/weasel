# Audit round 54 — area `quantity`

## resolveUnitExpr overflows the stack on a long flat chain of terms; the depth guard only counts parentheses and signs
- where: packages/quantity/src/unitExpr.ts:149 (resolveNode), with the parser's loops at 81–98 (sum, product) and 121–124 (primary)
- scenario: `resolveUnitExpr(Array(50_000).fill('1in').join('+'), { unitSystem: IMPERIAL_INCHES })`, or a compound like `'1in '.repeat(50_000)`. `sum`, `product` and the compound loop in `primary` build a left-deep `add` tree iteratively, so `deeper`/`MAX_DEPTH` never fires. `resolveNode` then recurses once per term on `expr.left`, and tens of thousands of terms throw a bare `RangeError: Maximum call stack size exceeded`. It should resolve the sum, or refuse it with its own `unitExpr:` error as nested parentheses are refused (ba7e062025). The comment at line 70 says recursion is bounded by parentheses and signs, but binary operators and compound terms add resolver depth too. The long-text property test never reaches the resolver on such a chain: every tail it appends (`''`, `x`, `)`, `.`, ` ft`, `%`) makes parsing or tokenizing throw first.
- evidence: read
- severity: medium

## multiplier parse is quadratic in a run of spaces
- where: packages/quantity/src/kinds/proportion.ts:323 (multiplierKind.parse)
- scenario: `parseAs('5' + ' '.repeat(100_000) + 'a', multiplier())`. The unanchored `/\s*[x×X]\s*$/` starts at every space, consumes the rest of the run, fails on `a`, and backtracks through it, so the time is O(n²). Commit 3a07b60008 rewrote the same shape out of fraction, percent and ratio ("read a long run of spaces ... in linear time"), and duration got the same fix. Multiplier was missed, and it is not in `parse.long.pbt.test.ts`'s display list. It should run in linear time and answer NaN.
- evidence: read
- severity: low

## a long digit run ending in junk before a unit parses in quadratic time
- where: packages/quantity/src/number.ts:241 (compoundTermsOf)
- scenario: `parseAs('1'.repeat(100_000) + 'x ft', unit('ft', { accepts: { ft: 12, in: 1 } }))`. `unitSuffixOf` finds `ft`, and then `new RegExp('(?:\\d+(?:\\.\\d+)?|\\.\\d+)\\s*$').exec('111…1x ')` runs unanchored. At each digit, `\d+` consumes up to `x`, then `\s*$` fails at every shorter backtrack, so the time is O(n²). In a non-`en-US` locale it runs twice, because `parseNumberIn` retries in `en-US` on NaN. Commit 8bf18660e5's linear-time guarantee covers only `…1x` with no unit after it, and the property test's tails never place a unit after junk. It should run in linear time and return NaN.
- evidence: read
- severity: low

## fraction and ratio read a division by zero as ±Infinity, where every other reader refuses a non-finite number
- where: packages/quantity/src/kinds/proportion.ts:175 (parseFraction), :289 (ratioKind.parse)
- scenario: typing `1/0` into a `fraction()` field gives `Infinity`, and `-1:0` in a `ratio()` field gives `-Infinity`. `readNumber` deliberately answers NaN for any non-finite result (number.ts:111, `1e400` → NaN), and `parseAs` documents infinity as read only from the display's word, `∞` or `infinity`. These two kinds hand back an infinity no display word produced, so a field without `endless` gets ±Infinity from typed digits unless its caller guards. It should be NaN.
- evidence: read
- severity: low

## a range's separator is spaced for a negative end that shows as 0
- where: packages/quantity/src/composite.ts:46 (rangeSeparator)
- scenario: `rangeParts(-0.0001, 5, decimal())`. The first end shows `0` (`intlParts`/`unsignedZero` drop the sign of a negative that rounds to zero), but `amount(from) < 0` is true, so the text is `0 – 5` rather than `0–5`. The doc says the dash is "spaced when an end is negative", which should mean negative as shown. The sign test and the shown text answer the same question two different ways.
- evidence: read
- severity: low

## a `fraction({ of: 'e' })` field strips the `e` out of exponent notation
- where: packages/quantity/src/kinds/proportion.ts:232–235 (fractionKind.parse)
- scenario: with the constant `e`, the token regex is `/e/i`. Typing `1e3` (or `2E-1`) matches the token, `text.replace(token, '')` leaves `13`, and the result is 13·e ≈ 35.3. Every other kind reads `1e3` as 1000. It should take the constant only where it stands as a factor, not inside a number's exponent.
- evidence: read
- severity: low

## ordinal speaks a negative with a bare minus sign
- where: packages/quantity/src/kinds/numeral.ts:83–93 (ordinalKind, no `speak`)
- scenario: `present(-3, ordinal()).spoken` is `−3rd`. With no `speak`, the kind falls back to the formatted text, which carries U+2212. Every other built-in kind passes its spoken text through `spokenSign`, because a screen reader renders `−3` as a dash or drops it (kind.ts:55–59). It should be `minus 3rd`.
- evidence: read
- severity: low

## roman parse does not round, where integer and ordinal parse do
- where: packages/quantity/src/kinds/numeral.ts:63–66 (romanKind.parse)
- scenario: a `roman()` field shows only whole numbers (`toRoman` rounds, and out of range it formats with `maximumFractionDigits: 0`). Typing `2.5` commits 2.5, which then shows as `III`, whereas `integerKind.parse` and `ordinalKind.parse` pass the same text through `roundWhole`. The whole-number kinds disagree on whether a typed fraction survives. It should be rounded as theirs are.
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
