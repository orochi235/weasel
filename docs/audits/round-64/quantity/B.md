# Audit round 64 — area `quantity`

Note: the frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4 is not in this clone (`git cat-file` reports a
bad object). The tree read is HEAD 6f634fabe1, which has no local changes under `packages/quantity`.

## `QuantityView.to` retargets a unit display's `unit` but keeps its `accepts`, so the converted view reads typed text in the old unit
- where: packages/quantity/src/present.ts:186 (QuantityView.to, `shown`)
- scenario: `qty(tag(12, unit('in', { accepts: { in: 1, ft: 12 } }), 'in')).to('mm', system)` gives a display
  `{ kind: 'unit', unit: 'mm', accepts: { in: 1, ft: 12 } }`. `unitKind.parse` uses `accepts` ahead of the unit name,
  so on the converted view `.parse('1in')` returns 1, read as 1 mm rather than 25.4, and `.parse('25mm')` returns
  NaN because `mm` is not in the table. The display now shows mm and can't read back what it shows. `accepts` should
  be rescaled into the target unit, or dropped, when `unit` is retargeted. The retargeting landed in f164d0e1c9.
- evidence: read
- severity: medium

## A multiplier display with `symbol: ''` reads every typed value as NaN
- where: packages/quantity/src/kinds/proportion.ts:326 (multiplierKind.parse)
- scenario: `parseAs('2.5', multiplier({ symbol: '' }))`. `text.trimEnd().endsWith('')` is true, and
  `slice(0, -''.length)` is `slice(0, -0)`, which is `''`. So `parseNumberIn('')` returns NaN for every input, though
  format writes the bare `2.5`. It should strip nothing when the symbol is empty.
- evidence: read
- severity: medium

## `percent`'s spoken form rounds `value * 100` in binary and can disagree with the shown text
- where: packages/quantity/src/kinds/proportion.ts:25 (percentKind.speak)
- scenario: `format` hands the value to `Intl`'s `style: 'percent'`, which scales the shortest decimal by 100
  exactly, so 0.145 shows `15%`. `speak` multiplies first: `0.145 * 100` is 14.499999999999998, which rounds to
  `14 percent`. A screen reader then says a different number from the one on screen. The same split happens at any
  `places` wherever the binary product lands just under a half. Speak should round the same way format does.
- evidence: read (the two rounding paths); the 0.145 figures are worked from IEEE-754 and ICU's decimal scaling, not run
- severity: medium

## `readInfinity` lowercases typed text in the field's locale before comparing it to English spellings, so `INF` / `Infinity` don't read in `tr-TR` or `az`
- where: packages/quantity/src/infinity.ts:35,40 (readInfinity)
- scenario: with locale `tr-TR`, a user types `Infinity` or `INF`. `toLocaleLowerCase('tr-TR')` maps `I` to dotless
  `ı`, giving `ınfınıty` / `ınf`. Neither is in `SPELLINGS` (`inf`, `infinity`, `infinite`), so the text reads as NaN
  rather than Infinity, while `inf` typed in lower case works. The fixed English spellings should be compared
  locale-independently (`toLowerCase`).
- evidence: read
- severity: low

## `scientific` formats NaN as `NaN × 10⁰` (and `NaNe0`)
- where: packages/quantity/src/kinds/scientific.ts:29 (split) / :60 (scientificKind.format)
- scenario: `present(NaN, scientific())`. `split` only special-cases 0, so the `nan` part goes into the mantissa, the
  empty exponent becomes `Number('') === 0`, and the text is `NaN × 10⁰`. It is spoken `NaN times 10 to the power of
  0`, with a MathML `<msup>` for it. Every other kind that can see a non-finite value (fraction, ratio, duration,
  zoom) writes `NaN` alone.
- evidence: read
- severity: low

## Per-locale caches in `number.ts` and `fieldLocale.ts` grow without a bound
- where: packages/quantity/src/number.ts:129 (`shapes`, shapeOf); packages/quantity/src/fieldLocale.ts:9 (`settled`, fieldLocale)
- scenario: both are module-level `Map`s keyed by the caller's locale string, with no eviction. `fieldLocale` takes
  any `requested` string (QuantityText passes even an explicit `locale` through it), and `shapeOf` runs for every
  locale parsed in. An app that builds locale tags (`-u-nu-…`, `-u-ca-…` extensions, user-entered tags) adds an
  entry for each distinct string, for the life of the page. Each cache should be capped, or keyed by the canonical
  tag.
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
