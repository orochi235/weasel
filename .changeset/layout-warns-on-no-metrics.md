---
'@weasel-js/text': patch
---

layoutRuns warns when a run resolves no metrics at all

A run whose family resolves to neither an atlas nor an outline face was
skipped in silence. Downstream that is indistinguishable from empty text —
no groups, no bounds, no diagnostic — so a consumer sees a blank canvas and
has nothing to search for.

The tier already warns per missing glyph. This is the same warning one level
up: it names the family and variant, says that neither tier resolved, and
points at the registration calls. It fires once per family variant.

It also names the cause that produces this without any mistake in consumer
code: two copies of `@weasel-js/font` in `node_modules`. The registry is
module state, so a second copy is a second, empty registry — the consumer
registers a face into one while `layoutRuns` reads the other, and every run
is skipped.
