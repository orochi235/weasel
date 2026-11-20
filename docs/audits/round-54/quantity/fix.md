A1 fixed 1d7a6dee15 — a fraction counted in a constant took cubic time on a run of spaces (A); measured 1.5 s at 2,000 spaces and 5 s at 3,000 before the fix
A2 fixed 45fae01c67 — multiplier parse took quadratic time on a run of spaces (A); about 2 s at 60,000 spaces before the fix
A3 fixed 526c16b9e6 — a long sum or compound value overflowed the stack in `resolveUnitExpr` (A)
A4 fixed cd507490fa — compound unit text took quadratic time in its number of terms (A); 730 ms for 10,000 terms before the fix
A5 fixed e4539d2fee — `scaleBar` labeled a bar shorter than every unit in the base unit, as `0m` (A)
A6 fixed 9c37d1ccb5 — `QuantityView.to` kept a display naming the old unit, so the result showed `1.2mm` (A)
B1 duplicate of A3 — `resolveUnitExpr` overflowed the stack on a flat chain of terms (B)
B2 duplicate of A2 — multiplier parse was quadratic in a run of spaces (B)
B3 fixed cd507490fa — a long digit run ending in junk before a unit took quadratic time (B); 715 ms at 20,000 digits before the fix. Same function as A4, fixed by the same rewrite
B4 fixed cf57cdd28e — fraction and ratio read a division by zero as ±Infinity (B)
B5 fixed 8d4c0315de — a range's dash was spaced for a negative end that shows as `0` (B)
B6 fixed 527781a2a4 — `fraction({ of: 'e' })` took the `e` out of exponent notation, so `1e3` read as 13·e (B)
B7 fixed c930835e19 — ordinal spoke a negative with a bare minus sign (B); fixed in `present`'s fallback for every kind with no `speak`, so registered custom kinds are covered too
B8 fixed 20023f8586 — roman parse did not round a typed decimal (B)

Extra defects:
sweep fixed d6382880b4 — the same infinity-from-digits defect as B4, in other readers: a number whose unit scales it past the range of a number read as Infinity in `unit()`, `bytes()`, `duration()`, and `parseNumber`. Examples are `1e308ft` shown in inches, `1e306TB`, `1e306h`, and a clock duration of 400 digits
sweep fixed 1d7a6dee15 — `- π`, a sign spaced from the constant, read as NaN in a `fraction({ of: 'π' })` field; it now reads as −π. Fixed by the A1 rewrite and covered by its test

Not a defect fix: f6440efb3d adds `multiplier()` and `fraction({ of: 'π' })` to the long-text parse property's displays. Before A3's fix that property failed when it happened to draw a long `1e1e…` chain, which was the A3 stack overflow.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, each with the fix in place: `kinds/proportion.test.ts` 11 passed; `parse.long.pbt.test.ts` 8 passed; `unitExpr.test.ts` 13 passed; `number.test.ts` 56 passed; `scaleBar.test.ts` 7 passed; `present.test.ts` 145 passed; `composite.test.ts` 11 passed; `kinds/numeral.test.ts` 1 passed (a new file). Each finding's new test was also run against the unfixed source and failed there.
- `npm run check:changesets`: OK — 2601 changeset(s)
- `npm run checks:gate`: all 32 passed
- `npm run lint -w @weasel-js/quantity`: the package has no `lint` script ("Missing script"). `npx eslint packages/quantity/src` passed clean.
- No browser tests touched. Tree is clean.

tally: 14 of 14 fixed, 2 extra fixed