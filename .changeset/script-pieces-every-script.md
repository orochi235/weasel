---
'@weasel-js/text-shaping': patch
---

`shape` cuts text wherever its Unicode script changes, for every script, rather than between a fixed list of
34 and lumping the rest into one piece: Cherokee beside Tifinagh, or Samaritan beside Cherokee, is now two
pieces, each shaped in its own direction. A piece's direction comes from the `Bidi_Class` of its first strong
letter, through `@weasel-js/bidi`, which is now a dependency. A closing bracket goes with the piece its
opening bracket was in, so in `abc (שלום) def` the `)` is shaped with the Latin rather than mirrored with the
Hebrew. Private-use and unassigned characters join the piece around them, as spaces and punctuation do.
