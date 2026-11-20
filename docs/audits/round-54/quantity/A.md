# Audit round 54, area `quantity`: findings

Note: the frozen commit named in the brief (608f35f5…) does not exist in this clone; the tree read is HEAD
830b463cc1, with no local changes under `packages/quantity`.

## A fraction counted in a constant reads a run of spaces in cubic time
- where: packages/quantity/src/kinds/proportion.ts:235 (fractionKind.parse)
- scenario: `parseAs('π' + ' '.repeat(3000) + '2', fraction({ of: 'π' }))`. Once the token is removed, the
  coefficient is 3000 spaces and then `2`. `/^(\s*[-−+]?\s*)(?=[/⁄]|\s*$)/` tries every split of the run
  between its two adjacent `\s*` and, for each split, scans the rest with the lookahead's `\s*$`: about k³/6
  steps, roughly 4.5e9 for k = 3000. The field hangs where it should answer NaN (or 2π) at once. The
  2026-11-18 fix (3a07b60008) made `parseFraction` linear but left this pattern alone, and
  `parse.long.pbt.test.ts` covers only `fraction()` without `of`.
- evidence: read (the regex was not run here; node was unavailable)
- severity: medium

## A multiplier reads a long run of spaces in quadratic time
- where: packages/quantity/src/kinds/proportion.ts:323 (multiplierKind.parse)
- scenario: `parseAs('2' + ' '.repeat(20000) + '5', multiplier())`. The pattern `/\s*[x×X]\s*$/` is not
  anchored, so from every position in the run `\s*` consumes to the run's end, fails on `[x×X]`, and
  backtracks: O(k²). This is the same shape that 3a07b60008 and c98a300605 measured at 260–500 ms for
  20,000 spaces in other kinds. `multiplier` is not among the displays in `parse.long.pbt.test.ts`.
- evidence: read
- severity: low

## A sum or compound value with many terms overflows the stack when resolved
- where: packages/quantity/src/unitExpr.ts:155 (resolveNode), built by unitExpr.ts:86 and :123 (sum, primary)
- scenario: `resolveUnitExpr('1+'.repeat(30000) + '1')`, or a long `1ft 1ft 1ft …`. The parser loops and
  builds a left-deep `add` chain whose depth equals the term count. `MAX_DEPTH` counts only parentheses and
  signs. `resolveNode` then recurses once per term and throws `RangeError: Maximum call stack size exceeded`,
  not the named `unitExpr:` error that ba7e062025 promised "instead of overflowing the stack". The
  long-text property never resolves such a chain: its `1+` and `2*` pieces always end in an operator or a
  junk tail, so parsing fails first.
- evidence: read (the depth where V8 overflows is inferred, not measured)
- severity: low

## Reading compound unit text is quadratic in the number of terms
- where: packages/quantity/src/number.ts:233 (compoundTermsOf)
- scenario: `parseAs('1 ft '.repeat(4000).trim(), unit('ft', { accepts: { ft: 12, in: 1 } }))`, or `'1B'.repeat(10000)`
  under `bytes()`. Each term walked does three things over the whole remaining text: it re-sorts the
  units, it runs `text.toLowerCase()` (in `unitSuffixOf`), and it runs an unanchored
  `(?:TERM_NUMBER)\s*$` exec from position 0. The cost is O(terms × length), around 2e8 steps for a
  20,000-character paste. The long-text property rarely reaches this path: it needs the `1 ft ` piece with
  an empty tail under the `unit` display, about 1 run in 1300.
- evidence: read
- severity: low

## scaleBar labels a bar shorter than one of its smallest unit in the base unit, rounding it to 0
- where: packages/quantity/src/scaleBar.ts:66-70 (scaleBar)
- scenario: a scope whose system has a unit smaller than its base, such as `{ base: 'm', units: { mm: 0.001, m: 1, km: 1000 } }`,
  zoomed in until less than 1 mm fits. `longestNice` picks 0.002 mm (length 2e-6). No unit gives at least
  one, so `fills` is empty and `chosen` is undefined. The label is then written as `length / 1` in
  `system.base` at three places: `0m`. It should be `0.002mm`; `longestNice` already treats "below one of
  a unit, only the smallest unit counts". The same fallback writes a half inch in a foot-based system as
  `0.042ft`. The test for this case uses `IMPERIAL_INCHES`, where the base is also the smallest unit, so it
  passes.
- evidence: read
- severity: medium

## QuantityView.to keeps a display that names the old unit, so the converted value shows with the wrong unit
- where: packages/quantity/src/present.ts:181-188 (QuantityView.to)
- scenario: `qty(tag(12, unit('mm'), 'mm')).to('cm', METRIC_MM).text` gives `'1.2mm'`. The value is
  converted and the `unit` tag becomes `cm`, but the display's own `unit: 'mm'` wins over the tag in
  `unitKind.format`, as documented. The same happens for a bare number shown with a `unit('mm')` fallback.
  `to` should either retag the display's unit or drop it. Today only the README's `unit()` with no name
  converts correctly.
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

<!-- done: 6 findings, files read: 23 -->
