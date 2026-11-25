I couldn't save `.skulk/out/findings.md` because permission to write it was refused, so the whole findings document is below.

# Audit round 37, area `bidi`

## The W, N and BD16 rules read across a mid-text paragraph separator, so the text after a `B` resolves against the paragraph before it
- where: packages/bidi/src/sequences.ts:51 (buildSequences), packages/bidi/src/implicit.ts:65-133 (resolveImplicit); entry point packages/bidi/src/index.ts:33 (analyze)
- scenario: A ruling on 2026-11-10 in `docs/unruled.md` says `analyze` reads a paragraph separator mid-text "as UAX #9 does, as the end of its paragraph". X8 (explicit.ts:138), BD9 (paragraph.ts:34) and P2/P3 all stop at a `B`. `buildSequences` does not: it builds level runs straight across one. Under `'rtl'`, or `'auto'` resolving to 1, a `B` sits at the paragraph level next to text at that same level. Both paragraphs then land in one isolating run sequence, and every W and N rule takes the earlier paragraph's characters as context. Examples, worked by hand from the code:
  - `analyze([0x61, 0x0a, 0x21, 0x62], 'rtl')` is `a`, LF, `!`, `b`. It becomes one sequence `[L, B, ON, L]` with sos R. N1 resolves the run `[B, !]` between `a` and `b` as L, and I2 raises `!` to level 2. If `!` were read as the start of its own paragraph at level 1, it would sit between sos R and `b` (L), N2 would make it R, and its level would be 1.
  - `analyze([0x627, 0x0a, 0x24, 0x31], 'auto')` is Arabic alef, LF, `$`, `1`. W2 finds the alef as the last strong type before `1`, so `1` becomes AN and W5 never joins `$` to it. `$` resolves to R at level 1, `1` resolves to level 2, and the visual order comes out `1$`. With the second paragraph on its own (sos R), `$1` is ET EN, W5 makes both EN at level 2, and they read `$1`.
  - W1 turns an NSM directly after a `B` into class `B`, when at the start of a paragraph it should take sos. BD16 pairs a `(` with a `)` in the next paragraph, so N0 resolves brackets from two different paragraphs as one pair.
  - Expected: each paragraph's runs start a new sequence at the `B`, with sos and eos taken from the paragraph level, the way P1 would split them.
- evidence: read (traced by hand; not run)
- severity: medium

## Files read
packages/bidi/src/__fixtures__/parseConformance.ts
packages/bidi/src/explicit.ts
packages/bidi/src/implicit.ts
packages/bidi/src/index.ts
packages/bidi/src/paragraph.ts
packages/bidi/src/pbt.fixture.ts
packages/bidi/src/reorder.ts
packages/bidi/src/resolve.ts
packages/bidi/src/sequences.ts
packages/bidi/src/tables.ts
packages/bidi/src/types.ts

<!-- done: 1 findings, files read: 11 -->